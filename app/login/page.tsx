"use client";

import { useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function signUp() {
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password: pw });
    if (error) return setMsg(error.message);
    setMsg("Registriert. Falls E-Mail-Bestätigung aktiv ist: Postfach prüfen.");
  }

  async function signIn() {
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) return setMsg(error.message);
    router.push("/group");
  }

  return (
    <div style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <br />
      <input
        placeholder="Passwort"
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
      />
      <br />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={signIn}>Login</button>
        <button onClick={signUp}>Registrieren</button>
      </div>
      {msg && <p>{msg}</p>}
    </div>
  );
}
