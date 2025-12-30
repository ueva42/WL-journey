"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useMemo, useState } from "react";

function NavLink({ href, label }: { href: string; label: string }) {
  const path = usePathname();
  const active = path === href;

  return (
    <Link
      href={href}
      style={{
        padding: "8px 12px",
        borderRadius: 10,
        textDecoration: "none",
        border: "1px solid #333",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}

export default function Nav() {
  const supabase = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(8px)",
        background: "rgba(0,0,0,0.6)",
        borderBottom: "1px solid #222",
      }}
    >
      <div
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: 12,
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NavLink href="/dashboard" label="Dashboard" />
          <NavLink href="/group/dashboard" label="Gruppen-Dashboard" />
          <NavLink href="/group" label="Meine Gruppe" />
          <NavLink href="/potatoes" label="Der Plan 2.0" />
          {/* später:
          <NavLink href="/potatoes" label="Kartoffelliste" />
          */}
        </div>

        <button
          onClick={logout}
          disabled={busy}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #333",
            background: "transparent",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "…" : "Logout"}
        </button>
      </div>
    </div>
  );
}
