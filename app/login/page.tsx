"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
    else window.location.href = "/dashboard";
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: ".6rem .7rem", boxSizing: "border-box",
    border: "1px solid var(--border-strong)", fontSize: 14,
    fontFamily: "inherit", color: "var(--text)", outline: "none",
  };

  return (
    <main style={{ maxWidth: 340, margin: "9rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 650, letterSpacing: "-0.02em", margin: 0 }}>Argus</h1>

      <button
        className="btn"
        onClick={signInWithGoogle}
        style={{ width: "100%", justifyContent: "center", padding: ".65rem", marginTop: "1.5rem" }}
      >
        Continue with Google
      </button>

      <div style={{ textAlign: "center", color: "var(--muted-2)", margin: "1rem 0", fontSize: 13 }}>or</div>

      <form onSubmit={signInWithPassword} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: "100%", justifyContent: "center", padding: ".65rem", marginTop: 2 }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {error && <p style={{ color: "crimson", fontSize: 13, marginTop: "1rem" }}>{error}</p>}
    </main>
  );
}
