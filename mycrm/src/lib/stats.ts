import type { LeadRow } from "./google-sheets";

export type Stats = {
  totalLeads: number;
  dmsSent: number;
  replies: number;
  replyRate: number | null;
  callsBooked: number;
  won: number;
  callBookingRate: number | null;
  conversionRate: number | null;
};

const has = (value: string | undefined) => Boolean(value && value.trim());

/** Percentage, or null when the denominator is zero (never NaN/Infinity). */
function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function computeStats(rows: LeadRow[]): Stats {
  const totalLeads = rows.filter((r) => has(r["Lead ID"])).length;
  const dmsSent = rows.filter((r) => has(r["DM Sent Date & Time"])).length;
  const replies = rows.filter((r) => has(r["Reply Date"])).length;
  const callsBooked = rows.filter((r) => has(r["Call Booked Date"])).length;
  const won = rows.filter((r) => r["Outcome"]?.trim() === "Won").length;

  return {
    totalLeads,
    dmsSent,
    replies,
    replyRate: safeRate(replies, dmsSent),
    callsBooked,
    won,
    callBookingRate: safeRate(callsBooked, dmsSent),
    conversionRate: safeRate(won, dmsSent),
  };
}
