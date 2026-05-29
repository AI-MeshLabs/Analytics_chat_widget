import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsIntent } from "@/lib/analytics/intents";
import { getAnalyticsSchema, getSupabaseServiceKey, getSupabaseUrl } from "@/lib/supabaseConfig";

export type DateFilterKey = "today" | "yesterday" | "this_week" | "this_month" | "last_week" | "last_month";
export type CustomDateRange = {
  start: Date;
  end: Date;
};
const CALL_DATA_TABLE = "call_data";
const CALLS_TABLE = "calls";
const CALL_DATE_COLUMN = "call_date";

let supabaseSingleton: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServiceKey();
  if (!supabaseSingleton) {
    supabaseSingleton = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseSingleton;
}

type DateFilterQueryable = {
  gte: (column: string, value: string) => DateFilterQueryable;
  lt: (column: string, value: string) => DateFilterQueryable;
  in: (column: string, values: string[]) => DateFilterQueryable;
};

function getDateRange(dateFilter: DateFilterKey): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (dateFilter === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(24, 0, 0, 0);
    return { start, end };
  }

  if (dateFilter === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (dateFilter === "this_week") {
    const currentDay = now.getDay();
    const daysSinceMonday = (currentDay + 6) % 7;
    start.setDate(now.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 7);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (dateFilter === "last_week") {
    const currentDay = now.getDay();
    const daysSinceMonday = (currentDay + 6) % 7;
    end.setDate(now.getDate() - daysSinceMonday);
    end.setHours(0, 0, 0, 0);
    start.setTime(end.getTime());
    start.setDate(end.getDate() - 7);
    return { start, end };
  }

  if (dateFilter === "last_month") {
    start.setDate(1);
    start.setMonth(start.getMonth() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1);
  end.setDate(1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Filter on calls.call_date (when the call happened). */
function applyCallDateFilter<T extends DateFilterQueryable>(
  query: T,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
): T {
  const { start, end } = customDateRange ?? getDateRange(dateFilter);
  return query
    .gte(CALL_DATE_COLUMN, start.toISOString())
    .lt(CALL_DATE_COLUMN, end.toISOString()) as T;
}

function aggregateCountByKey(
  rows: Array<Record<string, unknown>>,
  key: string,
  outputKey: string,
  countKey: string,
  limit: number,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    const group = value == null || value === "" ? "Unknown" : String(value);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([group, count]) => ({ [outputKey]: group, [countKey]: count }))
    .sort((a, b) => Number(b[countKey]) - Number(a[countKey]))
    .slice(0, limit);
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String(error.message ?? "").toLowerCase() : "";
  return message.includes("column") && message.includes("does not exist");
}

function getAgentLabel(row: Record<string, unknown>): string {
  const candidate = row.booking_practitioner ?? row.agent_name ?? row.name;
  if (candidate == null || candidate === "") return "Unknown";
  return String(candidate);
}

function getDispositionLabel(row: Record<string, unknown>): string {
  const candidate = row.disposition ?? row.call_type ?? row.status;
  if (candidate == null || candidate === "") return "Unknown";
  return String(candidate);
}

function getDurationSeconds(row: Record<string, unknown>): number {
  const raw = row.duration_secs ?? row.duration_seconds;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function toCallDateKey(raw: unknown): string | null {
  if (!raw) return null;
  const parsed = new Date(String(raw));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

async function selectCallsWithDateFilter(
  selectColumns: string,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
  options?: { limit?: number },
): Promise<Array<Record<string, unknown>>> {
  let query = getSupabase().schema(getAnalyticsSchema()).from(CALLS_TABLE).select(selectColumns);
  query = applyCallDateFilter(query, dateFilter, customDateRange);
  if (options?.limit != null) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

async function getCallIdsInDateRange(
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
): Promise<string[]> {
  const rows = await selectCallsWithDateFilter("id", dateFilter, customDateRange);
  return rows.map((row) => String(row.id ?? "")).filter(Boolean);
}

async function selectCallDataWithDateFilter(
  selectColumns: string,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
  options?: { limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const callIds = await getCallIdsInDateRange(dateFilter, customDateRange);
  if (!callIds.length) return [];

  let query = getSupabase()
    .schema(getAnalyticsSchema())
    .from(CALL_DATA_TABLE)
    .select(selectColumns)
    .in("call_id", callIds);
  if (options?.limit != null) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

async function countCallsWithDateFilter(
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
  options?: {
    in?: {
      column: string;
      values: string[];
    };
  },
): Promise<number> {
  let query = getSupabase()
    .schema(getAnalyticsSchema())
    .from(CALLS_TABLE)
    .select("*", { count: "exact", head: true });
  query = applyCallDateFilter(query, dateFilter, customDateRange);
  if (options?.in) {
    query = query.in(options.in.column, options.in.values);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function runCallDetailsReadQuery(
  intent: AnalyticsIntent,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
): Promise<Array<Record<string, unknown>>> {
  try {
    switch (intent) {
      case "calls_today":
      case "calls_this_week": {
        const countFilter = intent === "calls_this_week" ? "this_week" : dateFilter;
        const callsCount = await countCallsWithDateFilter(countFilter, customDateRange);
        return [{ total_calls: callsCount }];
      }

      case "average_duration": {
        const durationSampleLimit = 8000;
        const [callsRows, callDataRows] = await Promise.all([
          selectCallsWithDateFilter("duration_secs", dateFilter, customDateRange, {
            limit: durationSampleLimit,
          }),
          selectCallDataWithDateFilter("transcript", dateFilter, customDateRange, {
            limit: durationSampleLimit,
          }),
        ]);

        const explicitDurations = callsRows.map(getDurationSeconds).filter((value) => value > 0);
        const transcriptEstimates = callDataRows
          .map((row) => String(row.transcript ?? "").trim())
          .map((transcript) => (transcript ? Math.round(transcript.split(/\s+/).length / 2.5) : 0));

        const allDurations = [...explicitDurations, ...transcriptEstimates];
        const total = allDurations.reduce((sum, value) => sum + value, 0);
        const average = allDurations.length ? Math.round(total / allDurations.length) : 0;
        return [{ average_duration_seconds: average }];
      }

      case "unsuccessful_calls": {
        const count = await countCallsWithDateFilter(dateFilter, customDateRange, {
          in: { column: "status", values: ["failed", "missed", "incomplete", "dropped"] },
        }).catch(() => 0);
        return [{ unsuccessful_calls: count }];
      }

      case "calls_by_day": {
        const data = await selectCallsWithDateFilter(CALL_DATE_COLUMN, dateFilter, customDateRange);
        const counts = new Map<string, number>();
        for (const row of data) {
          const callDate = toCallDateKey(row[CALL_DATE_COLUMN]);
          if (!callDate) continue;
          counts.set(callDate, (counts.get(callDate) ?? 0) + 1);
        }
        return [...counts.entries()]
          .map(([call_date, total_calls]) => ({ call_date, total_calls }))
          .sort((a, b) => String(b.call_date).localeCompare(String(a.call_date)))
          .slice(0, 31);
      }

      case "calls_by_agent": {
        const callsRows = await selectCallsWithDateFilter(
          "booking_practitioner,name",
          dateFilter,
          customDateRange,
        ).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        const normalizedRows = callsRows.map((row) => ({ agent_name: getAgentLabel(row) }));
        return aggregateCountByKey(normalizedRows, "agent_name", "agent_name", "total_calls", 25);
      }

      case "top_dispositions": {
        const callsRows = await selectCallsWithDateFilter(
          "call_type,status",
          dateFilter,
          customDateRange,
        ).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        if (callsRows.length) {
          const normalizedRows = callsRows.map((row) => ({ disposition: getDispositionLabel(row) }));
          return aggregateCountByKey(normalizedRows, "disposition", "disposition", "total_count", 10);
        }
        const callDataRows = await selectCallDataWithDateFilter("sentiment", dateFilter, customDateRange);
        return aggregateCountByKey(callDataRows, "sentiment", "disposition", "total_count", 10);
      }

      case "longest_calls": {
        const callsRows = await selectCallsWithDateFilter(
          "id,duration_secs,call_date",
          dateFilter,
          customDateRange,
        ).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        const callDataRows = await selectCallDataWithDateFilter("call_id,transcript", dateFilter, customDateRange);
        const normalizedCallsRows = callsRows.map((row) => ({
          call_id: row.id,
          duration_seconds: getDurationSeconds(row),
          call_started_at: row[CALL_DATE_COLUMN],
        }));
        const normalizedCallDataRows = callDataRows.map((row) => {
          const transcript = String(row.transcript ?? "");
          return {
            call_id: row.call_id,
            duration_seconds: transcript ? Math.round(transcript.split(/\s+/).length / 2.5) : 0,
            call_started_at: null,
          };
        });
        return [...normalizedCallsRows, ...normalizedCallDataRows]
          .sort((a, b) => Number(b.duration_seconds) - Number(a.duration_seconds))
          .slice(0, 20);
      }

      case "call_status_summary": {
        const callsRows = await selectCallsWithDateFilter("status", dateFilter, customDateRange).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        if (callsRows.length) {
          return aggregateCountByKey(callsRows, "status", "status", "total_count", 10);
        }
        const callDataRows = await selectCallDataWithDateFilter("sentiment", dateFilter, customDateRange);
        return aggregateCountByKey(callDataRows, "sentiment", "status", "total_count", 10);
      }

      case "unknown":
      default:
        return [];
    }
  } catch (error) {
    console.error("Database query failed", error);
    throw new Error("Unable to process analytics query.");
  }
}
