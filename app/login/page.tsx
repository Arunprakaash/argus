"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function signInWithGoogle() {
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback?next=/dashboard` },
    });
    if (error) setError(error.message);
  }

  async function signInWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=/dashboard` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main style={{ maxWidth: 340, margin: "9rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Argus</h1>
      <p style={{ color: "var(--muted)", fontSize: ".9rem", marginTop: 4 }}>
        The watchful guardian for your interview agent. Sign in to continue.
      </p>

      <button
        className="btn"
        onClick={signInWithGoogle}
        style={{ width: "100%", justifyContent: "center", padding: ".65rem", marginTop: "1.5rem" }}
      >
        Continue with Google
      </button>

      <div style={{ textAlign: "center", color: "var(--muted-2)", margin: "1rem 0", fontSize: 13 }}>or</div>

      {sent ? (
        <p className="muted">Check your email for a magic sign-in link.</p>
      ) : (
        <form onSubmit={signInWithEmail}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%", padding: ".6rem .7rem", boxSizing: "border-box",
              border: "1px solid var(--border-strong)", borderRadius: 6, fontSize: 14,
            }}
          />
          <button type="submit" className="btn" style={{ width: "100%", justifyContent: "center", padding: ".65rem", marginTop: ".5rem" }}>
            Send magic link
          </button>
        </form>
      )}

      {error && <p style={{ color: "crimson", marginTop: "1rem" }}>{error}</p>}
    </main>
  );
}
