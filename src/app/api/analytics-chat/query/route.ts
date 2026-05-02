import { NextResponse } from "next/server";
import { getAnalyticsIntent, type AnalyticsIntent } from "@/lib/analytics/intents";
import { runCallDetailsReadQuery, type CustomDateRange, type DateFilterKey } from "@/lib/db";

/** Allow slow analytics queries on serverless hosts (e.g. Vercel). */
export const maxDuration = 60;

/** Allow embedded widgets on other origins to POST to this API. */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

type QueryRequestBody = {
  question?: string;
};

type QueryResponse = {
  answer: string;
  data: Array<Record<string, unknown>>;
  meta: {
    intent: AnalyticsIntent;
    timestamp: string;
  };
};

const UNKNOWN_INTENT_MESSAGE =
  "I can only help with call analytics such as call volume, duration, unsuccessful calls, and trends.";
const CACHE_TTL_MS = 60 * 1000;
const analyticsCache = new Map<string, { expiresAt: number; value: QueryResponse }>();

function getDateFilterFromQuestion(question: string): DateFilterKey {
  const normalized = question.toLowerCase();

  if (
    normalized.includes("last week") ||
    normalized.includes("previous week") ||
    normalized.includes("past week") ||
    normalized.includes("week before")
  ) {
    return "last_week";
  }
  if (
    normalized.includes("last month") ||
    normalized.includes("previous month") ||
    normalized.includes("past month") ||
    normalized.includes("month before")
  ) {
    return "last_month";
  }
  if (normalized.includes("yesterday")) return "yesterday";
  if (normalized.includes("today")) return "today";

  if (
    normalized.includes("this week") ||
    normalized.includes("weekly") ||
    normalized.includes("per week") ||
    normalized.includes("for the week") ||
    normalized.includes("week")
  ) {
    return "this_week";
  }

  if (
    normalized.includes("this month") ||
    normalized.includes("current month") ||
    normalized.includes("monthly") ||
    normalized.includes("per month") ||
    normalized.includes("for the month")
  ) {
    return "this_month";
  }

  return "today";
}

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function parseMonthDayPhrase(raw: string, defaultYear: number): Date | null {
  const value = raw.trim().toLowerCase();
  const m = value.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (!m?.[1] || m[2] === undefined) return null;
  const monthIdx = MONTH_NAME_TO_INDEX[m[1]];
  if (monthIdx === undefined) return null;
  const day = Number(m[2]);
  const year = m[3] ? Number(m[3]) : defaultYear;
  if (!Number.isFinite(day) || day < 1 || day > 31 || !Number.isFinite(year)) return null;
  const parsed = new Date(year, monthIdx, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== monthIdx || parsed.getDate() !== day) {
    return null;
  }
  return parsed;
}

function parseDateInput(raw: string): Date | null {
  const value = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("/");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^[a-z]{3,9}\s+\d{1,2}(?:,?\s+\d{4})?$/i.test(value)) {
    const currentYear = new Date().getFullYear();
    const parsed = parseMonthDayPhrase(value, currentYear);
    return parsed;
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

type ParsedCustomDateRange = {
  range: CustomDateRange;
  displayLabel: string;
};

/** Calendar tokens only — avoids matching phrases like "from 15" before "15/04/2026". */
const EXPLICIT_DATE_PATTERN =
  /\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4}/gi;

function extractExplicitCalendarDates(text: string): string[] {
  const dates: string[] = [];
  EXPLICIT_DATE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EXPLICIT_DATE_PATTERN.exec(text)) !== null) {
    dates.push(match[0]);
  }
  return dates;
}

function buildCustomRangeFromTokens(startToken: string, endToken: string): ParsedCustomDateRange | null {
  const startDate = parseDateInput(startToken);
  const endDateRaw = parseDateInput(endToken);
  if (!startDate || !endDateRaw) return null;

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDateRaw);
  end.setHours(24, 0, 0, 0);

  if (end <= start) return null;
  return { range: { start, end }, displayLabel: `${startToken} to ${endToken}` };
}

function getCustomDateRangeFromQuestion(question: string): ParsedCustomDateRange | null {
  const normalized = question.toLowerCase();
  const hasRangeKeyword =
    normalized.includes("to") || normalized.includes("from") || normalized.includes("between");

  // Prefer explicit DD/MM/YYYY (etc.) so "from 15/04/2026" never yields bogus tokens like "from 15".
  const explicitDates = extractExplicitCalendarDates(normalized);
  if (explicitDates.length >= 2 && hasRangeKeyword) {
    const parsed = buildCustomRangeFromTokens(explicitDates[0]!, explicitDates[1]!);
    if (parsed) return parsed;
  }

  const loosePattern =
    /(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{2}[\/-]\d{2}[\/-]\d{4}|[a-z]{3,9}\s+\d{1,2},?\s+\d{4}|[a-z]{3,9}\s+\d{1,2})/gi;
  const rawMatches = normalized.match(loosePattern) ?? [];
  const validTokens = rawMatches
    .map((token) => token.trim())
    .filter((token) => parseDateInput(token) !== null);

  if (validTokens.length >= 2 && hasRangeKeyword) {
    const parsed = buildCustomRangeFromTokens(validTokens[0]!, validTokens[1]!);
    if (parsed) return parsed;
  }

  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);

  const makeRelativeRange = (days: number): CustomDateRange => {
    const start = new Date(end);
    start.setDate(end.getDate() - days);
    return { start, end };
  };

  if (normalized.includes("last 7 days") || normalized.includes("past 7 days")) {
    return { range: makeRelativeRange(7), displayLabel: "last 7 days" };
  }
  if (normalized.includes("last 30 days") || normalized.includes("past 30 days")) {
    return { range: makeRelativeRange(30), displayLabel: "last 30 days" };
  }
  if (normalized.includes("last 90 days") || normalized.includes("past 90 days")) {
    return { range: makeRelativeRange(90), displayLabel: "last 90 days" };
  }

  const relativeDaysMatch = normalized.match(/last\s+(\d+)\s+days/);
  if (relativeDaysMatch?.[1]) {
    const days = Number(relativeDaysMatch[1]);
    if (Number.isFinite(days) && days > 0 && days <= 366) {
      return { range: makeRelativeRange(days), displayLabel: `last ${days} days` };
    }
  }

  return null;
}

function getDateLabel(dateFilter: DateFilterKey, customDateLabel: string | null): string {
  if (customDateLabel) {
    return customDateLabel;
  }

  return dateFilter.replace("_", " ");
}

/** Local calendar key aligned with `getDateRange` in db.ts (server timezone). */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Preset filters reuse the same question text ("today", etc.). Include a bucket so cache entries
 * expire when the calendar window changes (e.g. after midnight), not only after TTL.
 */
function getPresetCacheBucket(dateFilter: DateFilterKey): string {
  const now = new Date();

  if (dateFilter === "today") {
    return `day:${formatLocalYmd(now)}`;
  }

  if (dateFilter === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return `day:${formatLocalYmd(d)}`;
  }

  if (dateFilter === "this_week") {
    const d = new Date(now);
    const daysSinceMonday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - daysSinceMonday);
    d.setHours(0, 0, 0, 0);
    return `weekStart:${formatLocalYmd(d)}`;
  }

  if (dateFilter === "this_month") {
    return `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  if (dateFilter === "last_week") {
    const end = new Date(now);
    const daysSinceMonday = (now.getDay() + 6) % 7;
    end.setDate(now.getDate() - daysSinceMonday);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - 7);
    return `lastWeek:${formatLocalYmd(start)}_${formatLocalYmd(end)}`;
  }

  if (dateFilter === "last_month") {
    const anchor = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `lastMonth:${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}`;
  }

  return `preset:${dateFilter}`;
}

function getCacheKey(
  question: string,
  dateFilter: DateFilterKey,
  customDateRange: CustomDateRange | null,
  customDateLabel: string | null,
): string {
  const normalizedQuestion = question.trim().toLowerCase().replace(/\s+/g, " ");
  if (customDateRange) {
    return `${normalizedQuestion}|custom:${customDateLabel ?? ""}|${customDateRange.start.toISOString()}|${customDateRange.end.toISOString()}`;
  }
  return `${normalizedQuestion}|preset:${dateFilter}|${getPresetCacheBucket(dateFilter)}`;
}

function getCachedResponse(cacheKey: string): QueryResponse | null {
  const cached = analyticsCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    analyticsCache.delete(cacheKey);
    return null;
  }
  return cached.value;
}

function setCachedResponse(cacheKey: string, value: QueryResponse) {
  analyticsCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function buildAnswer(
  intent: AnalyticsIntent,
  rows: Array<Record<string, unknown>>,
  dateFilter: DateFilterKey,
  customDateLabel: string | null,
): string {
  const first = rows[0] ?? {};
  const label = getDateLabel(dateFilter, customDateLabel);

  switch (intent) {
    case "calls_today":
    case "calls_this_week":
      return `Total calls for ${label}: ${toNumber(first.total_calls)}.`;
    case "average_duration":
      return `Average call duration for ${label}: ${toNumber(first.average_duration_seconds)} seconds.`;
    case "unsuccessful_calls":
      return `Unsuccessful calls for ${label}: ${toNumber(first.unsuccessful_calls)}.`;
    case "calls_by_day":
      return rows.length ? "Here is the calls-by-day breakdown." : "No calls found for this period.";
    case "calls_by_agent":
      return rows.length ? "Here are the top agents by call volume." : "No agent call data found for this period.";
    case "top_dispositions":
      return rows.length ? "Here are the top call dispositions." : "No disposition data found for this period.";
    case "longest_calls":
      return rows.length ? "Here are the longest calls in this period." : "No calls found for this period.";
    case "call_status_summary":
      return rows.length ? "Here is the call status summary." : "No status data found for this period.";
    case "unknown":
    default:
      return UNKNOWN_INTENT_MESSAGE;
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  let body: QueryRequestBody;

  try {
    body = (await request.json()) as QueryRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Provide { \"question\": \"string\" }." },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      { error: "The 'question' field is required." },
      { status: 400, headers: corsHeaders(request) },
    );
  }

  try {
    const intent = getAnalyticsIntent(question);
    const dateFilter = getDateFilterFromQuestion(question);
    const parsedCustomDateRange = getCustomDateRangeFromQuestion(question);
    const customDateRange = parsedCustomDateRange?.range ?? null;
    const customDateLabel = parsedCustomDateRange?.displayLabel ?? null;
    const cacheKey = getCacheKey(question, dateFilter, customDateRange, customDateLabel);

    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      return NextResponse.json(cachedResponse, { status: 200, headers: corsHeaders(request) });
    }

    if (intent === "unknown") {
      const unknownResponse: QueryResponse = {
        answer: UNKNOWN_INTENT_MESSAGE,
        data: [],
        meta: {
          intent,
          timestamp: new Date().toISOString(),
        },
      };
      setCachedResponse(cacheKey, unknownResponse);
      return NextResponse.json(unknownResponse, { status: 200, headers: corsHeaders(request) });
    }

    const data = await runCallDetailsReadQuery(intent, dateFilter, customDateRange ?? undefined);
    const response: QueryResponse = {
      answer: buildAnswer(intent, data, dateFilter, customDateLabel),
      data,
      meta: {
        intent,
        timestamp: new Date().toISOString(),
      },
    };

    setCachedResponse(cacheKey, response);
    return NextResponse.json(response, { status: 200, headers: corsHeaders(request) });
  } catch (error) {
    console.error("Analytics query failed", error);
    return NextResponse.json(
      { error: "Unable to process analytics request." },
      { status: 500, headers: corsHeaders(request) },
    );
  }
}
