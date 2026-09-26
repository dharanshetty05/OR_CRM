import { NextResponse } from "next/server";
import { fetchLeadRows } from "@/lib/google-sheets";
import { computeStats } from "@/lib/stats";

export async function GET() {
  try {
    const rows = await fetchLeadRows();
    const stats = computeStats(rows);
    return NextResponse.json({ stats, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error("[/api/stats]", err);
    const message =
      err instanceof Error ? err.message : "Unknown error reading the sheet.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
