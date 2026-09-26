"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = {
  totalLeads: number;
  dmsSent: number;
  replies: number;
  replyRate: number | null;
  callsBooked: number;
  won: number;
  callBookingRate: number | null;
  conversionRate: number | null;
};

type ApiResponse =
  | { stats: Stats; fetchedAt: string }
  | { error: string };

type Accent = "violet" | "indigo" | "blueviolet" | "emerald" | "green" | "amber" | "neutral";
type IconKind = "leads" | "sent" | "replies" | "calls" | "won" | "percent";

const ACCENTS: Record<Accent, { solid: string; tint: string }> = {
  violet: { solid: "#a78bfa", tint: "rgba(167,139,250,0.14)" },
  indigo: { solid: "#6366f1", tint: "rgba(99,102,241,0.16)" },
  blueviolet: { solid: "#8b5cf6", tint: "rgba(139,92,246,0.14)" },
  emerald: { solid: "#10b981", tint: "rgba(16,185,129,0.15)" },
  green: { solid: "#22c55e", tint: "rgba(34,197,94,0.16)" },
  amber: { solid: "#f59e0b", tint: "rgba(245,158,11,0.15)" },
  neutral: { solid: "#a39cae", tint: "rgba(255,255,255,0.06)" },
};

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function formatRate(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      const body: ApiResponse = await res.json();

      if (!res.ok || "error" in body) {
        const message = "error" in body ? body.error : "Couldn't load the sheet.";
        setError(message);
        return;
      }

      setStats(body.stats);
      setFetchedAt(body.fetchedAt);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount. All state updates happen after an `await`,
    // never synchronously inside the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false);
  }, [load]);

  const lastUpdatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="relative min-h-screen w-full bg-[#08070b]">
      {/* ambient background glow */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-12%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-[#7c3aed] opacity-[0.09] blur-[130px]" />
        <div className="absolute bottom-[-18%] right-[-8%] h-[420px] w-[420px] rounded-full bg-[#4f46e5] opacity-[0.08] blur-[120px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-14 sm:px-10">
        <header className="mb-10 flex flex-col gap-6 border-b border-white/[0.07] pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 rounded-full bg-[#a78bfa]"
                style={{ boxShadow: "0 0 12px 2px rgba(167,139,250,0.55)" }}
                aria-hidden
              />
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Outreach Dashboard
              </h1>
            </div>
            <p className="mt-2 text-sm text-[#8e8898]">
              Track your outreach performance.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-[#6f6a7d] tabular-nums">
              {loading
                ? "Loading…"
                : lastUpdatedLabel
                  ? `Updated ${lastUpdatedLabel}`
                  : "Not yet loaded"}
            </span>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#141219] px-3.5 py-2 text-sm font-medium text-[#e9e6ee] shadow-sm shadow-black/30 transition-colors hover:border-[#8b5cf6]/40 hover:bg-[#18151f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08070b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshIcon spinning={refreshing} />
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/[0.06] px-6 py-5">
            <p className="text-sm font-medium text-white">Couldn&apos;t load the sheet</p>
            <p className="mt-1 text-sm text-[#c9a3a3]">{error}</p>
            <button
              type="button"
              onClick={() => load(false)}
              className="mt-3 text-sm font-medium text-[#a78bfa] underline underline-offset-2 hover:text-[#c4b5fd] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08070b]"
            >
              Try again
            </button>
          </div>
        )}

        {!error && loading && <LoadingState />}

        {!error && !loading && stats && stats.totalLeads === 0 && (
          <div className="rounded-xl border border-white/[0.07] bg-[#121016] px-6 py-16 text-center">
            <p className="text-sm font-medium text-white">No leads yet in the LEADS tab</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-[#8e8898]">
              Add rows with a Lead ID to your Google Sheet, then refresh to see
              your outreach metrics here.
            </p>
          </div>
        )}

        {!error && !loading && stats && stats.totalLeads > 0 && (
          <div className="flex flex-col gap-8">
            {/* Hero: reply rate */}
            <section className="relative overflow-hidden rounded-2xl border border-[#8b5cf6]/25 bg-[#121018] px-7 py-8 sm:px-10">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#8b5cf6] opacity-20 blur-[100px]"
              />
              <div className="relative flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-[#b3a7d6]">Reply rate</p>
                  <p className="mt-3 text-6xl font-semibold tracking-tight text-white sm:text-7xl">
                    {formatRate(stats.replyRate)}
                  </p>
                  <p className="mt-3 text-sm text-[#9c96a8]">
                    {formatCount(stats.replies)} {stats.replies === 1 ? "reply" : "replies"} from{" "}
                    {formatCount(stats.dmsSent)} DMs sent
                  </p>
                </div>
                <ReplyRateRing value={stats.replyRate} />
              </div>
            </section>

            {/* Secondary metrics */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <MetricCard
                label="Total leads"
                value={formatCount(stats.totalLeads)}
                accent="neutral"
                icon="leads"
              />
              <MetricCard
                label="DMs sent"
                value={formatCount(stats.dmsSent)}
                accent="indigo"
                icon="sent"
                hint={
                  stats.totalLeads > 0
                    ? `${((stats.dmsSent / stats.totalLeads) * 100).toFixed(0)}% of leads`
                    : undefined
                }
              />
              <MetricCard
                label="Replies"
                value={formatCount(stats.replies)}
                accent="blueviolet"
                icon="replies"
              />
              <MetricCard
                label="Calls booked"
                value={formatCount(stats.callsBooked)}
                accent="emerald"
                icon="calls"
                hint={
                  stats.callBookingRate !== null
                    ? `${formatRate(stats.callBookingRate)} booking rate`
                    : undefined
                }
              />
              <MetricCard
                label="Won"
                value={formatCount(stats.won)}
                accent="green"
                icon="won"
                hint={
                  stats.conversionRate !== null
                    ? `${formatRate(stats.conversionRate)} conversion`
                    : undefined
                }
              />
              <MetricCard
                label="Call booking rate"
                value={formatRate(stats.callBookingRate)}
                accent="amber"
                icon="percent"
                hint={`${formatCount(stats.callsBooked)} calls booked`}
              />
              <MetricCard
                label="Conversion rate"
                value={formatRate(stats.conversionRate)}
                accent="violet"
                icon="percent"
                hint={`${formatCount(stats.won)} won`}
              />
            </section>

            {/* Performance overview */}
            <section>
              <h2 className="text-base font-medium text-white">Performance overview</h2>
              <p className="mt-1 text-sm text-[#8e8898]">
                How your leads move through each stage.
              </p>

              <div className="mt-5 flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-[#121016] px-6 py-6">
                <StageBar
                  label="Total leads"
                  value={stats.totalLeads}
                  total={stats.totalLeads}
                  accent="neutral"
                />
                <StageBar
                  label="DMs sent"
                  value={stats.dmsSent}
                  total={stats.totalLeads}
                  accent="indigo"
                />
                <StageBar
                  label="Replies"
                  value={stats.replies}
                  total={stats.totalLeads}
                  accent="blueviolet"
                  annotation={
                    stats.replyRate !== null ? `${formatRate(stats.replyRate)} reply rate` : undefined
                  }
                />
                <StageBar
                  label="Calls booked"
                  value={stats.callsBooked}
                  total={stats.totalLeads}
                  accent="emerald"
                  annotation={
                    stats.callBookingRate !== null
                      ? `${formatRate(stats.callBookingRate)} booking rate`
                      : undefined
                  }
                />
                <StageBar
                  label="Won"
                  value={stats.won}
                  total={stats.totalLeads}
                  accent="green"
                  annotation={
                    stats.conversionRate !== null
                      ? `${formatRate(stats.conversionRate)} conversion`
                      : undefined
                  }
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyRateRing({ value }: { value: number | null }) {
  const pct = Math.max(0, Math.min(value ?? 0, 100));
  const r = 40;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (circumference * pct) / 100;

  return (
    <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
      <svg viewBox="0 0 96 96" className="h-28 w-28 -rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="#a78bfa"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: "drop-shadow(0 0 6px rgba(167,139,250,0.55))" }}
        />
      </svg>
      <span className="absolute text-xs font-medium text-[#c9c2da]">of DMs</span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  icon,
  hint,
}: {
  label: string;
  value: string;
  accent: Accent;
  icon: IconKind;
  hint?: string;
}) {
  const c = ACCENTS[accent];
  return (
    <div
      className="rounded-xl border border-white/[0.06] bg-[#121016] px-5 py-5 transition-colors hover:border-white/[0.12]"
      style={{ borderTop: `2px solid ${c.solid}66` }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: c.tint, color: c.solid }}
      >
        <Icon kind={icon} />
      </span>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-white tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm text-[#8e8898]">{label}</p>
      {hint && <p className="mt-2 text-xs text-[#6f6a7d]">{hint}</p>}
    </div>
  );
}

function StageBar({
  label,
  value,
  total,
  accent,
  annotation,
}: {
  label: string;
  value: number;
  total: number;
  accent: Accent;
  annotation?: string;
}) {
  const pct = total > 0 ? Math.max((value / total) * 100, value > 0 ? 2 : 0) : 0;
  const c = ACCENTS[accent];

  return (
    <div className="flex items-center gap-4">
      <p className="w-28 shrink-0 text-sm text-[#948da3]">{label}</p>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, background: c.solid }}
        />
      </div>
      <p className="w-14 shrink-0 text-right text-sm font-medium text-white tabular-nums">
        {formatCount(value)}
      </p>
      <span
        className="hidden w-40 shrink-0 text-right text-xs font-medium sm:block"
        style={{ color: annotation ? c.solid : "transparent" }}
      >
        {annotation ?? "—"}
      </span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-[168px] motion-safe:animate-pulse rounded-2xl border border-white/[0.07] bg-[#121016]" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="motion-safe:animate-pulse rounded-xl border border-white/[0.06] bg-[#121016] px-5 py-5"
          >
            <p className="h-7 w-7 rounded-lg bg-white/[0.06]" />
            <p className="mt-4 h-8 w-16 rounded bg-white/[0.06]" />
            <p className="mt-2 h-3.5 w-20 rounded bg-white/[0.06]" />
          </div>
        ))}
      </div>
      <div className="h-52 motion-safe:animate-pulse rounded-xl border border-white/[0.07] bg-[#121016]" />
    </div>
  );
}

function Icon({ kind }: { kind: IconKind }) {
  const paths: Record<IconKind, string> = {
    leads: "M3 13a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
    sent: "M2.5 8 13 3l-3 10-2.3-4.2L2.5 8Z",
    replies: "M3 4.5h10v6H6.5L4 13V10.5H3v-6Z",
    calls:
      "M4 3.5c0 5.5 3 8.5 8.5 8.5l.6-2-2.6-1-1 1c-1.2-.6-2-1.4-2.6-2.6l1-1-1-2.6-2 .6Z",
    won: "M8 2.5 9.4 6l3.8.3-2.9 2.5.9 3.7L8 10.6l-3.2 1.9.9-3.7L2.8 6.3 6.6 6 8 2.5Z",
    percent:
      "M4.5 11.5 11.5 4.5M5.5 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm5 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  };

  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d={paths[kind]}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={`h-3.5 w-3.5 ${spinning ? "motion-safe:animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.53-3.8M13.5 2v3.2h-3.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}