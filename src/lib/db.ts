import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AnalyticsIntent } from "@/lib/analytics/intents";

export type DateFilterKey = "today" | "yesterday" | "this_week" | "this_month" | "last_week" | "last_month";
export type CustomDateRange = {
  start: Date;
  end: Date;
};
const ANALYTICS_SCHEMA = "onepoint";
const CALL_DATA_TABLE = "call_data";
const CALLS_TABLE = "calls";

let supabaseSingleton: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_KEY must be configured.");
  }
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

function applyDateFilter<T extends DateFilterQueryable>(
  query: T,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
): T {
  const { start, end } = customDateRange ?? getDateRange(dateFilter);
  return query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString()) as T;
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

async function selectWithDateFilter(
  table: string,
  selectColumns: string,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
  options?: { limit?: number },
): Promise<Array<Record<string, unknown>>> {
  let query = getSupabase().schema(ANALYTICS_SCHEMA).from(table).select(selectColumns);
  query = applyDateFilter(query, dateFilter, customDateRange);
  if (options?.limit != null) {
    query = query.limit(options.limit);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

async function countWithDateFilter(
  table: string,
  dateFilter: DateFilterKey,
  customDateRange?: CustomDateRange,
  options?: {
    in?: {
      column: string;
      values: string[];
    };
  },
): Promise<number> {
  // Use * so count works if the table has no `id` column (e.g. only call_id).
  let query = getSupabase()
    .schema(ANALYTICS_SCHEMA)
    .from(table)
    .select("*", { count: "exact", head: true });
  query = applyDateFilter(query, dateFilter, customDateRange);
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
        const callsCount = await countWithDateFilter(CALLS_TABLE, countFilter, customDateRange);
        return [{ total_calls: callsCount }];
      }

      case "average_duration": {
        /** Cap rows so KPI polling cannot download unbounded transcripts (was causing multi‑minute hangs). */
        const durationSampleLimit = 8000;
        const [callDataRows, callsRows] = await Promise.all([
          selectWithDateFilter(CALL_DATA_TABLE, "transcript", dateFilter, customDateRange, {
            limit: durationSampleLimit,
          }),
          selectWithDateFilter(CALLS_TABLE, "duration_seconds", dateFilter, customDateRange, {
            limit: durationSampleLimit,
          }).catch(() => []),
        ]);
        const transcriptEstimates = callDataRows
          .map((row) => String(row.transcript ?? "").trim())
          .map((transcript) => (transcript ? Math.round(transcript.split(/\s+/).length / 2.5) : 0));

        const explicitDurations = callsRows
          .map((row) => Number(row.duration_seconds))
          .filter((value) => Number.isFinite(value) && value >= 0);
        const allDurations = [...explicitDurations, ...transcriptEstimates];
        const total = allDurations.reduce((sum, value) => sum + value, 0);
        const average = allDurations.length ? Math.round(total / allDurations.length) : 0;
        return [{ average_duration_seconds: average }];
      }

      case "unsuccessful_calls": {
        const [sentimentCount, statusCount] = await Promise.all([
          countWithDateFilter(CALL_DATA_TABLE, dateFilter, customDateRange, {
            in: { column: "sentiment", values: ["negative", "very_negative", "angry", "frustrated"] },
          }),
          countWithDateFilter(CALLS_TABLE, dateFilter, customDateRange, {
            in: { column: "status", values: ["failed", "missed", "incomplete", "dropped"] },
          }).catch(() => 0),
        ]);
        return [{ unsuccessful_calls: sentimentCount + statusCount }];
      }

      case "calls_by_day": {
        const data = await selectWithDateFilter(CALLS_TABLE, "created_at", dateFilter, customDateRange).catch(() => []);
        const counts = new Map<string, number>();
        for (const row of data) {
          const callDateRaw = row.created_at;
          if (!callDateRaw) continue;
          const callDate = new Date(String(callDateRaw)).toISOString().slice(0, 10);
          counts.set(callDate, (counts.get(callDate) ?? 0) + 1);
        }
        return [...counts.entries()]
          .map(([call_date, total_calls]) => ({ call_date, total_calls }))
          .sort((a, b) => String(b.call_date).localeCompare(String(a.call_date)))
          .slice(0, 31);
      }

      case "calls_by_agent": {
        const callsRows = await selectWithDateFilter(CALLS_TABLE, "agent_name", dateFilter, customDateRange).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        if (callsRows.length) {
          return aggregateCountByKey(callsRows, "agent_name", "agent_name", "total_calls", 25);
        }
        return [];
      }

      case "top_dispositions": {
        const callsRows = await selectWithDateFilter(CALLS_TABLE, "disposition", dateFilter, customDateRange).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        if (callsRows.length) {
          return aggregateCountByKey(callsRows, "disposition", "disposition", "total_count", 10);
        }
        const callDataRows = await selectWithDateFilter(CALL_DATA_TABLE, "sentiment", dateFilter, customDateRange);
        return aggregateCountByKey(callDataRows, "sentiment", "disposition", "total_count", 10);
      }

      case "longest_calls": {
        const callsRows = await selectWithDateFilter(
          CALLS_TABLE,
          "call_id,duration_seconds,created_at",
          dateFilter,
          customDateRange,
        ).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        const callDataRows = await selectWithDateFilter(
          CALL_DATA_TABLE,
          "call_id,transcript,created_at",
          dateFilter,
          customDateRange,
        );
        const normalizedCallsRows = callsRows.map((row) => ({
          call_id: row.call_id,
          duration_seconds: Number(row.duration_seconds) || 0,
          call_started_at: row.created_at,
        }));
        const normalizedCallDataRows = callDataRows
          .map((row) => {
            const transcript = String(row.transcript ?? "");
            return {
              call_id: row.call_id,
              duration_seconds: transcript ? Math.round(transcript.split(/\s+/).length / 2.5) : 0,
              call_started_at: row.created_at,
            };
          });
        return [...normalizedCallsRows, ...normalizedCallDataRows]
          .sort((a, b) => Number(b.duration_seconds) - Number(a.duration_seconds))
          .slice(0, 20);
      }

      case "call_status_summary": {
        const callsRows = await selectWithDateFilter(CALLS_TABLE, "status", dateFilter, customDateRange).catch((error) => {
          if (isMissingColumnError(error)) return [];
          throw error;
        });
        if (callsRows.length) {
          return aggregateCountByKey(callsRows, "status", "status", "total_count", 10);
        }
        const callDataRows = await selectWithDateFilter(CALL_DATA_TABLE, "sentiment", dateFilter, customDateRange);
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
