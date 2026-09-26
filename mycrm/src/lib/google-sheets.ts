import "server-only";
import { JWT } from "google-auth-library";

/**
 * Server-only access to the LEADS sheet.
 *
 * This module must never be imported from a Client Component. The
 * `server-only` import above makes that a build-time error if it happens
 * by accident.
 */

const SHEET_NAME = "LEADS";

export type LeadRow = Record<string, string>;

let cachedClient: JWT | null = null;

function getClient(): JWT {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in the environment."
    );
  }

  cachedClient = new JWT({
    email,
    // .env files store the key with literal "\n" sequences; restore real newlines.
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return cachedClient;
}

/**
 * Fetches every row of the LEADS tab and returns it as an array of objects
 * keyed by the sheet's own header row, so column order in the sheet can
 * change without breaking the app.
 */
export async function fetchLeadRows(): Promise<LeadRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID in the environment.");
  }

  const client = getClient();
  const { token } = await client.getAccessToken();
  if (!token) {
    throw new Error("Failed to obtain a Google access token.");
  }

  const range = encodeURIComponent(`${SHEET_NAME}!A1:Z`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Google Sheets API error (${res.status}): ${body || res.statusText}`
    );
  }

  const data: { values?: string[][] } = await res.json();
  const rows = data.values ?? [];

  if (rows.length === 0) return [];

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim());

  return dataRows
    .filter((row) => row.some((cell) => cell !== undefined && cell !== ""))
    .map((row) => {
      const record: LeadRow = {};
      headers.forEach((header, i) => {
        record[header] = (row[i] ?? "").trim();
      });
      return record;
    });
}
