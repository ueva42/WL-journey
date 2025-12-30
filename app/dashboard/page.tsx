"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type WeighIn = {
  id: string;
  user_id: string;
  entry_date: string; // YYYY-MM-DD
  weight_kg: number;
};

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDateDE(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function toNumberSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function daysBetween(aISO: string, bISO: string) {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function findPrevWeekEntry(entriesDesc: WeighIn[]) {
  if (!entriesDesc.length) return null;
  const latest = entriesDesc[0];
  const target = new Date(latest.entry_date + "T00:00:00");
  target.setDate(target.getDate() - 7);
  const targetISO = target.toISOString().slice(0, 10);
  for (const e of entriesDesc) {
    if (e.entry_date <= targetISO) return e;
  }
  return null;
}

// Mini-Timeline: Dots wenn wenige Seiten, sonst Slider
function MiniTimeline({
  pageCount,
  currentPage,
  onJump,
}: {
  pageCount: number;
  currentPage: number;
  onJump: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  // Wenn zu viele Seiten: Slider statt Dots
  if (pageCount > 20) {
    return (
      <div className="mt-2">
        <div className="flex items-center justify-between text-xs opacity-70 mb-1">
          <span>Neuer</span>
          <span>
            Seite {currentPage + 1} / {pageCount}
          </span>
          <span>Älter</span>
        </div>
        <input
          type="range"
          min={0}
          max={pageCount - 1}
          value={currentPage}
          onChange={(e) => onJump(Number(e.target.value))}
          className="w-full"
        />
      </div>
    );
  }

  // Dots (klickbar)
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <span className="text-xs opacity-70">Neuer</span>
      <div className="flex items-center gap-1">
        {Array.from({ length: pageCount }).map((_, i) => {
          const active = i === currentPage;
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              title={`Seite ${i + 1}`}
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.25)",
                background: active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.12)",
              }}
            />
          );
        })}
      </div>
      <span className="text-xs opacity-70">Älter</span>

      <span className="text-xs opacity-70 ml-2">
        Seite {currentPage + 1}/{pageCount}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Eingabe
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState<string>("");

  // Zielgewicht
  const [targetWeight, setTargetWeight] = useState<string>("");
  const [savingTarget, setSavingTarget] = useState(false);

  // Einträge (neu -> alt)
  const [entries, setEntries] = useState<WeighIn[]>([]);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState<string>("");

  // Chart-Paging + iOS-sicherer Swipe
  const CHART_WINDOW = 10;
  const [chartOffset, setChartOffset] = useState(0); // 0 = neueste
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartTime, setSwipeStartTime] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setStatus("");
        const { data: u } = await supabase.auth.getUser();
        const user = u.user;
        if (!user) {
          setMyUserId(null);
          setEntries([]);
          return;
        }
        setMyUserId(user.id);
        await loadTargetWeight(user.id);
        await loadWeighIns(user.id);
      } catch (e: any) {
        setStatus(e?.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTargetWeight(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("target_weight_kg")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    setTargetWeight(data?.target_weight_kg == null ? "" : String(data.target_weight_kg));
  }

  async function loadWeighIns(userId: string) {
    const { data, error } = await supabase
      .from("weigh_ins")
      .select("id, user_id, entry_date, weight_kg")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false });
    if (error) throw error;

    setEntries(
      (data ?? []).map((x: any) => ({
        id: x.id,
        user_id: x.user_id,
        entry_date: x.entry_date,
        weight_kg: Number(x.weight_kg),
      }))
    );
    setChartOffset(0);
  }

  async function saveTarget() {
    try {
      if (!myUserId) throw new Error("Nicht eingeloggt.");
      setSavingTarget(true);
      setStatus("");
      const n = toNumberSafe(targetWeight);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Zielgewicht ungültig.");
      const { error } = await supabase
        .from("profiles")
        .update({ target_weight_kg: n })
        .eq("user_id", myUserId);
      if (error) throw error;
      setStatus("Zielgewicht gespeichert.");
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setSavingTarget(false);
    }
  }

  async function addWeighIn() {
    try {
      if (!myUserId) throw new Error("Nicht eingeloggt.");
      setBusy(true);
      setStatus("");

      const entryDate = date;
      const w = toNumberSafe(weight);
      if (!entryDate) throw new Error("Datum fehlt.");
      if (!Number.isFinite(w) || w <= 0) throw new Error("Gewicht ungültig.");

      const { data: existing, error: exErr } = await supabase
        .from("weigh_ins")
        .select("id")
        .eq("user_id", myUserId)
        .eq("entry_date", entryDate)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) {
        setStatus("Für dieses Datum existiert schon ein Eintrag. Bitte bearbeiten oder löschen.");
        return;
      }

      const { error } = await supabase.from("weigh_ins").insert({
        user_id: myUserId,
        entry_date: entryDate,
        weight_kg: w,
      });
      if (error) throw error;

      setWeight("");
      await loadWeighIns(myUserId);
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, current: number) {
    setEditingId(id);
    setEditWeight(String(current));
    setStatus("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditWeight("");
  }

  async function saveEdit(id: string) {
    try {
      if (!myUserId) throw new Error("Nicht eingeloggt.");
      setBusy(true);
      setStatus("");
      const w = toNumberSafe(editWeight);
      if (!Number.isFinite(w) || w <= 0) throw new Error("Gewicht ungültig.");
      const { error } = await supabase
        .from("weigh_ins")
        .update({ weight_kg: w })
        .eq("id", id)
        .eq("user_id", myUserId);
      if (error) throw error;
      setEditingId(null);
      setEditWeight("");
      await loadWeighIns(myUserId);
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(id: string) {
    try {
      if (!myUserId) throw new Error("Nicht eingeloggt.");
      setBusy(true);
      setStatus("");
      const { error } = await supabase
        .from("weigh_ins")
        .delete()
        .eq("id", id)
        .eq("user_id", myUserId);
      if (error) throw error;
      await loadWeighIns(myUserId);
    } catch (e: any) {
      setStatus(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  // Kennzahlen
  const latest = entries[0] ?? null;
  const prevWeek = useMemo(() => findPrevWeekEntry(entries), [entries]);
  const diffToGoal = useMemo(() => {
    const tw = toNumberSafe(targetWeight);
    if (!latest || !Number.isFinite(tw)) return null;
    return latest.weight_kg - tw;
  }, [latest, targetWeight]);
  const diffToPrevWeek = useMemo(() => {
    if (!latest || !prevWeek) return null;
    return latest.weight_kg - prevWeek.weight_kg;
  }, [latest, prevWeek]);

  // Chart paging
  const maxOffset = Math.max(0, entries.length - CHART_WINDOW);

  const pageCount = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.ceil(entries.length / CHART_WINDOW);
  }, [entries.length]);

  const currentPage = useMemo(() => {
    return Math.floor(Math.min(chartOffset, maxOffset) / CHART_WINDOW);
  }, [chartOffset, maxOffset]);

  const pageDesc = useMemo(() => {
    const start = Math.min(chartOffset, maxOffset);
    return entries.slice(start, start + CHART_WINDOW);
  }, [entries, chartOffset, maxOffset]);

  const chartData = useMemo(
    () => pageDesc.slice().reverse().map((e) => ({ date: e.entry_date, weight: e.weight_kg })),
    [pageDesc]
  );

  const rangeLabel = useMemo(() => {
    if (pageDesc.length === 0) return "";
    // pageDesc: neu -> alt
    const newest = pageDesc[0]?.entry_date;
    const oldest = pageDesc[pageDesc.length - 1]?.entry_date;
    if (!newest || !oldest) return "";
    return `${fmtDateDE(oldest)} – ${fmtDateDE(newest)}`;
  }, [pageDesc]);

  function goOlder() {
    setChartOffset((o) => Math.min(o + CHART_WINDOW, maxOffset));
  }
  function goNewer() {
    setChartOffset((o) => Math.max(o - CHART_WINDOW, 0));
  }

  function jumpToPage(page: number) {
    const p = Math.max(0, Math.min(page, Math.max(0, pageCount - 1)));
    setChartOffset(p * CHART_WINDOW);
  }

  // iOS-sicherer Pointer-Swipe (Rand ignorieren)
  function canStartSwipe(clientX: number, el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const edge = 28; // px
    return clientX > r.left + edge && clientX < r.right - edge;
  }
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const el = e.currentTarget;
    if (!canStartSwipe(e.clientX, el)) return;
    setSwipeStartX(e.clientX);
    setSwipeStartTime(Date.now());
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch" || swipeStartX == null || swipeStartTime == null) return;
    const dx = e.clientX - swipeStartX;
    const dt = Date.now() - swipeStartTime;
    const THRESH = 45;
    if (dt <= 900) {
      if (dx <= -THRESH) goOlder();
      else if (dx >= THRESH) goNewer();
    }
    setSwipeStartX(null);
    setSwipeStartTime(null);
  }
  function onPointerCancel() {
    setSwipeStartX(null);
    setSwipeStartTime(null);
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Eingabe */}
      <div className="rounded-2xl border border-white/15 bg-white/5 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <div className="text-sm opacity-80 mb-1">Datum</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <div className="text-sm opacity-80 mb-1">Gewicht (kg)</div>
            <input
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
              inputMode="decimal"
            />
          </div>
          <button
            onClick={addWeighIn}
            disabled={busy || !myUserId}
            className="w-full rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            {busy ? "…" : "Eintragen"}
          </button>
        </div>

        {/* Zielgewicht */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <input
            value={targetWeight}
            onChange={(e) => setTargetWeight(e.target.value)}
            placeholder="Ziel (kg)"
            className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none"
            inputMode="decimal"
          />
          <button
            onClick={saveTarget}
            disabled={savingTarget || !myUserId}
            className="rounded-xl border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
          >
            {savingTarget ? "…" : "Ziel speichern"}
          </button>
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">Letzter Eintrag</div>
            <div className="text-lg font-semibold">
              {latest ? `${latest.weight_kg.toFixed(1)} kg` : "—"}
            </div>
            <div className="text-xs opacity-70">{latest ? fmtDateDE(latest.entry_date) : ""}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">Differenz zum Ziel</div>
            <div className="text-lg font-semibold">
              {diffToGoal == null ? "—" : `${diffToGoal > 0 ? "+" : ""}${diffToGoal.toFixed(1)} kg`}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs opacity-70">Differenz zur Vorwoche</div>
            <div className="text-lg font-semibold">
              {diffToPrevWeek == null ? "—" : `${diffToPrevWeek > 0 ? "+" : ""}${diffToPrevWeek.toFixed(1)} kg`}
            </div>
            <div className="text-xs opacity-70">
              {prevWeek && latest
                ? `vs. ${fmtDateDE(prevWeek.entry_date)} (${daysBetween(
                    latest.entry_date,
                    prevWeek.entry_date
                  )} Tage)`
                : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Chart + Mini Timeline */}
      <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
        <div className="flex items-center justify-between mb-1 gap-3">
          <div>
            <div className="text-sm font-semibold">Gewichts-Diagramm (10er-Fenster)</div>
            <div className="text-xs opacity-70">{rangeLabel}</div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={goNewer}
              disabled={chartOffset === 0}
              className="rounded-xl border border-white/15 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              Neuer
            </button>
            <button
              onClick={goOlder}
              disabled={chartOffset >= maxOffset}
              className="rounded-xl border border-white/15 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-50"
            >
              Älter
            </button>
          </div>
        </div>

        {/* Mini Timeline */}
        <MiniTimeline pageCount={pageCount} currentPage={currentPage} onJump={jumpToPage} />

        <div
          style={{
            width: "100%",
            height: 320,
            marginTop: 10,
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip
                labelFormatter={(v) => `Datum: ${fmtDateDE(String(v))}`}
                formatter={(v) => [`${Number(v).toFixed(1)} kg`, "Gewicht"]}
              />
              <Line type="monotone" dataKey="weight" dot />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="text-xs opacity-70 mt-2">Tipp: Im Diagramm links/rechts wischen.</div>
      </div>

      {/* Tabelle */}
      <div className="rounded-2xl border border-white/15 bg-white/5 p-5">
        <div className="text-sm font-semibold mb-3">Einträge (alle)</div>

        {entries.length === 0 ? (
          <div className="text-sm opacity-70">Keine Einträge.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="text-left text-sm opacity-80">
                  <th className="py-2">Datum</th>
                  <th className="py-2">kg</th>
                  <th className="py-2">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-white/10">
                    <td className="py-3">{e.entry_date}</td>
                    <td className="py-3">
                      {editingId === e.id ? (
                        <input
                          value={editWeight}
                          onChange={(ev) => setEditWeight(ev.target.value)}
                          className="w-28 rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm outline-none"
                          inputMode="decimal"
                        />
                      ) : (
                        e.weight_kg.toFixed(1)
                      )}
                    </td>
                    <td className="py-3">
                      {editingId === e.id ? (
                        <div className="flex gap-3">
                          <button
                            onClick={() => saveEdit(e.id)}
                            disabled={busy}
                            className="text-sm underline opacity-80 hover:opacity-100 disabled:opacity-50"
                          >
                            Speichern
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={busy}
                            className="text-sm underline opacity-80 hover:opacity-100 disabled:opacity-50"
                          >
                            Abbrechen
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => startEdit(e.id, e.weight_kg)}
                            disabled={busy}
                            className="text-sm underline opacity-80 hover:opacity-100 disabled:opacity-50"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => deleteEntry(e.id)}
                            disabled={busy}
                            className="text-sm underline opacity-80 hover:opacity-100 disabled:opacity-50"
                          >
                            Löschen
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {status && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
          {status}
        </div>
      )}
    </div>
  );
}
