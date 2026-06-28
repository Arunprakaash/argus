"""Interview Observer — agent-side SDK.

Attaches to *native* LiveKit events (``@session.on`` / ``@ctx.room.on``) and
forwards them to the Interview Observer backend. It does NOT call into or depend
on any of the agent's own functions — the judge decision and proctoring flags are
derived downstream from the native ``function_tools_executed`` tool-call events.

Transport mirrors how LiveKit itself emits telemetry: events are buffered and
flushed by a background task in batches, never blocking the live interview.
Failures are swallowed and logged.

Usage (purely additive in the agent):

    from interview_observer import Observer

    observer = Observer(
        base_url=os.environ["OBSERVER_INGEST_URL"],
        api_key=os.environ["OBSERVER_INGEST_KEY"],
        room_name=ctx.room.name,
    )
    observer.set_metadata(
        candidate_name=..., agent_name=..., interview_type=..., fixed_questions=[...],
    )
    observer.attach(session, ctx)
"""

from __future__ import annotations

import asyncio
import datetime
import logging
from typing import Any, Optional

logger = logging.getLogger("interview_observer")

# Native AgentSession events (livekit/agents/voice/events.py EventTypes).
SESSION_EVENTS = (
    "user_state_changed",
    "agent_state_changed",
    "user_input_transcribed",
    "conversation_item_added",
    "agent_false_interruption",
    "overlapping_speech",
    "function_tools_executed",
    "metrics_collected",
    "session_usage_updated",
    "speech_created",
    "error",
    "close",
)

# High-frequency, low-value events the SDK does not forward at all (the dashboard
# rolls usage from the session totals; interim transcripts are dropped below).
_SKIP_SEND = {"metrics_collected", "speech_created", "overlapping_speech", "session_usage_updated"}


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def _serialize(obj: Any) -> dict[str, Any]:
    """Best-effort JSON-able dict for a pydantic event or an rtc object."""
    if obj is None:
        return {}
    dump = getattr(obj, "model_dump", None)
    if callable(dump):
        try:
            return dump(mode="json", exclude_none=True)
        except Exception:  # pragma: no cover - defensive
            try:
                return dump()
            except Exception:
                pass
    # Fallback: pull common identity-ish attributes off rtc objects.
    out: dict[str, Any] = {}
    for attr in ("sid", "identity", "name", "kind", "source", "topic", "metadata"):
        val = getattr(obj, attr, None)
        if val is not None and not callable(val):
            out[attr] = str(val)
    if not out:
        out["repr"] = repr(obj)[:500]
    return out


def _participant(p: Any) -> dict[str, Any]:
    return {
        "identity": getattr(p, "identity", None),
        "sid": getattr(p, "sid", None),
        "name": getattr(p, "name", None),
    }


class Observer:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        room_name: str,
        batch_size: int = 20,
        flush_interval: float = 2.0,
        max_queue: int = 10_000,
        max_retries: int = 3,
    ) -> None:
        self._url = base_url.rstrip("/") + "/api/ingest/events"
        self._api_key = api_key
        self._room_name = room_name
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._max_retries = max_retries

        self._queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=max_queue)
        self._task: Optional[asyncio.Task[None]] = None
        self._closing = asyncio.Event()
        self._meta: Optional[dict[str, Any]] = None
        self._meta_pending = False
        self._dropped = 0

    # ── public API ────────────────────────────────────────────────────────────
    def set_metadata(
        self,
        *,
        candidate_name: Optional[str] = None,
        agent_name: Optional[str] = None,
        interview_type: Optional[str] = None,
        fixed_questions: Optional[list[str]] = None,
        raw: Optional[dict[str, Any]] = None,
    ) -> None:
        self._meta = {
            k: v
            for k, v in {
                "candidateName": candidate_name,
                "agentName": agent_name,
                "interviewType": interview_type,
                "fixedQuestions": fixed_questions,
                "raw": raw,
            }.items()
            if v is not None
        }
        self._meta_pending = bool(self._meta)

    def attach(self, session: Any, ctx: Any) -> None:
        """Register native session + room listeners and start the flush task."""
        self._ensure_task()

        for ev in SESSION_EVENTS:
            if ev in _SKIP_SEND:
                continue
            session.on(ev, self._session_handler(ev))

        room = getattr(ctx, "room", None)
        if room is not None:
            room.on("participant_connected", self._room_participant("participant_connected"))
            room.on("participant_disconnected", self._room_participant("participant_disconnected"))
            room.on("track_subscribed", self._room_track("track_subscribed"))
            room.on("track_published", self._room_track("track_published"))
            room.on("data_received", self._room_data("data_received"))

        # Drain on session close.
        session.on("close", lambda _ev: self._request_close())

    async def aclose(self) -> None:
        """Flush remaining events and stop the background task."""
        self._request_close()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=10.0)
            except Exception:
                self._task.cancel()

    # ── handlers ──────────────────────────────────────────────────────────────
    def _session_handler(self, event_type: str):
        def handler(ev: Any) -> None:
            data = _serialize(ev)
            # Drop interim (non-final) transcripts — only forward finalized text.
            if event_type == "user_input_transcribed" and not data.get("is_final", True):
                return
            self._enqueue("session", event_type, data)

        return handler

    def _room_participant(self, event_type: str):
        def handler(participant: Any) -> None:
            self._enqueue("room", event_type, _participant(participant))

        return handler

    def _room_track(self, event_type: str):
        def handler(*args: Any) -> None:
            # signatures vary: (track, publication, participant) or (publication, participant)
            participant = args[-1] if args else None
            data = {"participant": _participant(participant)}
            for a in args[:-1]:
                data.setdefault("tracks", []).append(_serialize(a))
            self._enqueue("room", event_type, data)

        return handler

    def _room_data(self, event_type: str):
        def handler(packet: Any) -> None:
            self._enqueue(
                "room",
                event_type,
                {
                    "topic": getattr(packet, "topic", None),
                    "participant": _participant(getattr(packet, "participant", None)),
                },
            )

        return handler

    # ── queue plumbing ──────────────────────────────────────────────────────────
    def _enqueue(self, source: str, event_type: str, data: dict[str, Any]) -> None:
        envelope: dict[str, Any] = {
            "roomName": self._room_name,
            "source": source,
            "type": event_type,
            "ts": _now_iso(),
            "data": data,
        }
        if self._meta_pending and self._meta:
            envelope["meta"] = self._meta
            self._meta_pending = False
        try:
            self._queue.put_nowait(envelope)
        except asyncio.QueueFull:
            # Bounded queue: drop on overflow rather than ever blocking the agent.
            self._dropped += 1
            if self._dropped % 100 == 1:
                logger.warning("interview_observer: queue full, dropped %d events", self._dropped)

    def _ensure_task(self) -> None:
        if self._task is None:
            self._task = asyncio.ensure_future(self._run())

    def _request_close(self) -> None:
        self._closing.set()

    async def _run(self) -> None:
        try:
            while True:
                batch = await self._collect_batch()
                if batch:
                    await self._flush(batch)
                if self._closing.is_set() and self._queue.empty():
                    break
        except asyncio.CancelledError:  # pragma: no cover
            pass
        except Exception:  # pragma: no cover - never let the task kill the agent
            logger.exception("interview_observer: flush loop crashed")

    async def _collect_batch(self) -> list[dict[str, Any]]:
        batch: list[dict[str, Any]] = []
        try:
            first = await asyncio.wait_for(self._queue.get(), timeout=self._flush_interval)
            batch.append(first)
        except asyncio.TimeoutError:
            return batch
        while len(batch) < self._batch_size and not self._queue.empty():
            batch.append(self._queue.get_nowait())
        return batch

    async def _flush(self, batch: list[dict[str, Any]]) -> None:
        import aiohttp

        payload = {"events": batch}
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        delay = 0.5
        for attempt in range(self._max_retries):
            try:
                async with aiohttp.ClientSession() as http:
                    async with http.post(
                        self._url,
                        json=payload,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=10),
                    ) as resp:
                        if resp.status < 300:
                            return
                        if resp.status in (401, 422):
                            logger.error("interview_observer: ingest rejected (%d)", resp.status)
                            return  # not retryable
            except Exception as exc:  # network error
                logger.debug("interview_observer: flush attempt %d failed: %s", attempt + 1, exc)
            await asyncio.sleep(delay)
            delay *= 2
        logger.warning("interview_observer: dropped batch of %d after retries", len(batch))
