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
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 360, margin: "8rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.4rem" }}>Sign in</h1>
      <p style={{ color: "#666", fontSize: ".9rem" }}>Interview Observer dashboard</p>

      <button
        onClick={signInWithGoogle}
        style={{ width: "100%", padding: ".7rem", marginTop: "1.5rem", cursor: "pointer" }}
      >
        Continue with Google
      </button>

      <div style={{ textAlign: "center", color: "#999", margin: "1rem 0" }}>or</div>

      {sent ? (
        <p>Check your email for a magic sign-in link.</p>
      ) : (
        <form onSubmit={signInWithEmail}>
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: ".6rem", boxSizing: "border-box" }}
          />
          <button type="submit" style={{ width: "100%", padding: ".7rem", marginTop: ".5rem", cursor: "pointer" }}>
            Send magic link
          </button>
        </form>
      )}

      {error && <p style={{ color: "crimson", marginTop: "1rem" }}>{error}</p>}
    </main>
  );
}
