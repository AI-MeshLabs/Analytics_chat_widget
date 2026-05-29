import type { AnalyticsIntent } from "@/lib/analytics/intents";
import { getAnalyticsSchema } from "@/lib/supabaseConfig";

export type DateFilterKey = "today" | "yesterday" | "this_week" | "this_month";

type QueryTemplateResult = {
  sql: string;
  params: string[];
  dateFilter: DateFilterKey;
};

const DATE_FILTER_CLAUSES: Record<DateFilterKey, string> = {
  today: "call_date >= CURRENT_DATE AND call_date < CURRENT_DATE + INTERVAL '1 day'",
  yesterday:
    "call_date >= CURRENT_DATE - INTERVAL '1 day' AND call_date < CURRENT_DATE",
  this_week: "call_date >= DATE_TRUNC('week', CURRENT_DATE)",
  this_month: "call_date >= DATE_TRUNC('month', CURRENT_DATE)",
};

const UNSAFE_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|replace|merge|execute|exec)\b|;/i;

function ensureSafeSelectOnly(sql: string, schema: string) {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith("select ")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  if (UNSAFE_SQL_PATTERN.test(normalized)) {
    throw new Error("Unsafe SQL operation detected in template.");
  }

  const schemaPrefix = schema.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const allowedTable =
    new RegExp(`\\bfrom\\s+${schemaPrefix}\\.call_data\\b`).test(normalized) ||
    new RegExp(`\\bfrom\\s+${schemaPrefix}\\.calls\\b`).test(normalized);
  if (!allowedTable) {
    throw new Error(`Templates must query only ${schema}.call_data or ${schema}.calls.`);
  }
}

function getDateClause(dateFilter: DateFilterKey) {
  return DATE_FILTER_CLAUSES[dateFilter];
}

export function getSafeAnalyticsQueryTemplate(
  intent: AnalyticsIntent,
  dateFilter: DateFilterKey = "today",
): QueryTemplateResult | null {
  const schema = getAnalyticsSchema();
  const filterClause = getDateClause(dateFilter);

  let sql: string | null = null;

  switch (intent) {
    case "calls_today":
      sql = `
        SELECT COUNT(*)::int AS total_calls
        FROM ${schema}.calls
        WHERE ${filterClause}
      `;
      break;

    case "calls_this_week":
      sql = `
        SELECT COUNT(*)::int AS total_calls
        FROM ${schema}.calls
        WHERE call_date >= DATE_TRUNC('week', CURRENT_DATE)
      `;
      break;

    case "average_duration":
      sql = `
        SELECT COALESCE(AVG(duration_secs), 0)::int AS average_duration_seconds
        FROM ${schema}.calls
        WHERE ${filterClause}
      `;
      break;

    case "unsuccessful_calls":
      sql = `
        SELECT COUNT(*)::int AS unsuccessful_calls
        FROM ${schema}.calls
        WHERE ${filterClause}
          AND LOWER(status::text) IN ('failed', 'missed', 'incomplete', 'dropped')
      `;
      break;

    case "calls_by_day":
      sql = `
        SELECT DATE_TRUNC('day', call_date)::date AS call_date, COUNT(*)::int AS total_calls
        FROM ${schema}.calls
        WHERE ${filterClause}
        GROUP BY DATE_TRUNC('day', call_date)::date
        ORDER BY call_date DESC
        LIMIT 31
      `;
      break;

    case "calls_by_agent":
      sql = `
        SELECT COALESCE(NULLIF(booking_practitioner, ''), NULLIF(name, ''), 'Unknown') AS agent_name, COUNT(*)::int AS total_calls
        FROM ${schema}.calls
        WHERE ${filterClause}
        GROUP BY COALESCE(NULLIF(booking_practitioner, ''), NULLIF(name, ''), 'Unknown')
        ORDER BY total_calls DESC
        LIMIT 25
      `;
      break;

    case "top_dispositions":
      sql = `
        SELECT COALESCE(NULLIF(call_type, ''), NULLIF(status, ''), 'Unknown') AS disposition, COUNT(*)::int AS total_count
        FROM ${schema}.calls
        WHERE ${filterClause}
        GROUP BY COALESCE(NULLIF(call_type, ''), NULLIF(status, ''), 'Unknown')
        ORDER BY total_count DESC
        LIMIT 10
      `;
      break;

    case "longest_calls":
      sql = `
        SELECT id AS call_id, duration_secs AS duration_seconds, call_date AS call_started_at
        FROM ${schema}.calls
        WHERE ${filterClause}
        ORDER BY duration_secs DESC NULLS LAST
        LIMIT 20
      `;
      break;

    case "call_status_summary":
      sql = `
        SELECT COALESCE(status, 'Unknown') AS status, COUNT(*)::int AS total_count
        FROM ${schema}.calls
        WHERE ${filterClause}
        GROUP BY COALESCE(status, 'Unknown')
        ORDER BY total_count DESC
        LIMIT 10
      `;
      break;

    case "unknown":
    default:
      return null;
  }

  ensureSafeSelectOnly(sql, schema);
  return {
    sql: sql.trim(),
    params: [],
    dateFilter,
  };
}
