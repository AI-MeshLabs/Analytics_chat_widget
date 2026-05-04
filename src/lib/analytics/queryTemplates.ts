import type { AnalyticsIntent } from "@/lib/analytics/intents";

export type DateFilterKey = "today" | "yesterday" | "this_week" | "this_month";

type QueryTemplateResult = {
  sql: string;
  params: string[];
  dateFilter: DateFilterKey;
};

const DATE_FILTER_CLAUSES: Record<DateFilterKey, string> = {
  today: "call_started_at >= CURRENT_DATE AND call_started_at < CURRENT_DATE + INTERVAL '1 day'",
  yesterday: "call_started_at >= CURRENT_DATE - INTERVAL '1 day' AND call_started_at < CURRENT_DATE",
  this_week: "call_started_at >= DATE_TRUNC('week', CURRENT_DATE)",
  this_month: "call_started_at >= DATE_TRUNC('month', CURRENT_DATE)",
};

const UNSAFE_SQL_PATTERN =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|create|replace|merge|execute|exec)\b|;/i;

function ensureSafeSelectOnly(sql: string) {
  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith("select ")) {
    throw new Error("Only SELECT queries are allowed.");
  }

  if (UNSAFE_SQL_PATTERN.test(normalized)) {
    throw new Error("Unsafe SQL operation detected in template.");
  }

  const allowedTable =
    /\bfrom\s+onepoint\.call_data\b/.test(normalized) || /\bfrom\s+onepoint\.calls\b/.test(normalized);
  if (!allowedTable) {
    throw new Error("Templates must query only onepoint.call_data or onepoint.calls.");
  }
}

function getDateClause(dateFilter: DateFilterKey) {
  return DATE_FILTER_CLAUSES[dateFilter];
}

export function getSafeAnalyticsQueryTemplate(
  intent: AnalyticsIntent,
  dateFilter: DateFilterKey = "today",
): QueryTemplateResult | null {
  const filterClause = getDateClause(dateFilter);

  let sql: string | null = null;

  switch (intent) {
    case "calls_today":
      sql = `
        SELECT COUNT(*)::int AS total_calls
        FROM onepoint.call_data
        WHERE ${filterClause}
      `;
      break;

    case "calls_this_week":
      sql = `
        SELECT COUNT(*)::int AS total_calls
        FROM onepoint.call_data
        WHERE call_started_at >= DATE_TRUNC('week', CURRENT_DATE)
      `;
      break;

    case "average_duration":
      sql = `
        SELECT COALESCE(AVG(duration_seconds), 0)::int AS average_duration_seconds
        FROM onepoint.call_data
        WHERE ${filterClause}
      `;
      break;

    case "unsuccessful_calls":
      sql = `
        SELECT COUNT(*)::int AS unsuccessful_calls
        FROM onepoint.calls
        WHERE ${filterClause}
          AND LOWER(status::text) IN ('failed', 'missed', 'incomplete', 'dropped')
      `;
      break;

    case "calls_by_day":
      sql = `
        SELECT DATE_TRUNC('day', call_started_at)::date AS call_date, COUNT(*)::int AS total_calls
        FROM onepoint.call_data
        WHERE ${filterClause}
        GROUP BY DATE_TRUNC('day', call_started_at)::date
        ORDER BY call_date DESC
        LIMIT 31
      `;
      break;

    case "calls_by_agent":
      sql = `
        SELECT COALESCE(agent_name, 'Unknown') AS agent_name, COUNT(*)::int AS total_calls
        FROM onepoint.call_data
        WHERE ${filterClause}
        GROUP BY COALESCE(agent_name, 'Unknown')
        ORDER BY total_calls DESC
        LIMIT 25
      `;
      break;

    case "top_dispositions":
      sql = `
        SELECT COALESCE(disposition, 'Unknown') AS disposition, COUNT(*)::int AS total_count
        FROM onepoint.call_data
        WHERE ${filterClause}
        GROUP BY COALESCE(disposition, 'Unknown')
        ORDER BY total_count DESC
        LIMIT 10
      `;
      break;

    case "longest_calls":
      sql = `
        SELECT call_id, duration_seconds, call_started_at
        FROM onepoint.call_data
        WHERE ${filterClause}
        ORDER BY duration_seconds DESC NULLS LAST
        LIMIT 20
      `;
      break;

    case "call_status_summary":
      sql = `
        SELECT COALESCE(status, 'Unknown') AS status, COUNT(*)::int AS total_count
        FROM onepoint.call_data
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

  ensureSafeSelectOnly(sql);
  return {
    sql: sql.trim(),
    params: [],
    dateFilter,
  };
}
