export const BRANCH_FILTERS = {
  ryde: "(LOWER(TRIM(branch_code::text)) = 'ryde' OR cliniko_business_id::text = '1948378953639014361')",
  springwood:
    "(LOWER(TRIM(branch_code::text)) = 'springwood' OR cliniko_business_id::text = '1102355493780725293')",
} as const;

export type BranchKey = keyof typeof BRANCH_FILTERS;

export function normalizeAnalyticsQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\bonepoint\s+/g, "")
    .replace(/\bspring\s*wood\b/g, "springwood")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectBranchFromQuestion(question: string): BranchKey | null {
  const q = normalizeAnalyticsQuestion(question);
  if (/\bryde\b/.test(q)) return "ryde";
  if (/\bspringwood\b/.test(q)) return "springwood";
  return null;
}

export type DateRangeFilters = {
  inbound: string;
  outbound: string;
  label:
    | "today"
    | "yesterday"
    | "today_and_yesterday"
    | "this_week"
    | "last_week"
    | "this_month"
    | "last_month";
};

export function detectDateRangeFromQuestion(question: string): DateRangeFilters {
  const q = normalizeAnalyticsQuestion(question);

  if (/today\s+and\s+yesterday|yesterday\s+and\s+today/.test(q)) {
    return {
      label: "today_and_yesterday",
      inbound:
        "call_date::date >= CURRENT_DATE - INTERVAL '1 day' AND call_date::date <= CURRENT_DATE",
      outbound:
        "call_started_at::date >= CURRENT_DATE - INTERVAL '1 day' AND call_started_at::date <= CURRENT_DATE",
    };
  }
  if (/\blast week\b|\bprevious week\b|\bpast week\b|\bweek before\b/.test(q)) {
    return {
      label: "last_week",
      inbound:
        "call_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND call_date < DATE_TRUNC('week', CURRENT_DATE)",
      outbound:
        "call_started_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND call_started_at < DATE_TRUNC('week', CURRENT_DATE)",
    };
  }
  if (/\bthis week\b|\bweekly\b|\bper week\b|\bfor the week\b/.test(q)) {
    return {
      label: "this_week",
      inbound: "call_date >= DATE_TRUNC('week', CURRENT_DATE)",
      outbound: "call_started_at >= DATE_TRUNC('week', CURRENT_DATE)",
    };
  }
  if (/\blast month\b|\bprevious month\b|\bpast month\b|\bmonth before\b/.test(q)) {
    return {
      label: "last_month",
      inbound:
        "call_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND call_date < DATE_TRUNC('month', CURRENT_DATE)",
      outbound:
        "call_started_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND call_started_at < DATE_TRUNC('month', CURRENT_DATE)",
    };
  }
  if (/\bthis month\b|\bcurrent month\b|\bmonthly\b|\bper month\b|\bfor the month\b/.test(q)) {
    return {
      label: "this_month",
      inbound: "call_date >= DATE_TRUNC('month', CURRENT_DATE)",
      outbound: "call_started_at >= DATE_TRUNC('month', CURRENT_DATE)",
    };
  }
  if (/\byesterday\b/.test(q) && !/\btoday\b/.test(q)) {
    return {
      label: "yesterday",
      inbound: "call_date::date = CURRENT_DATE - INTERVAL '1 day'",
      outbound: "call_started_at::date = CURRENT_DATE - INTERVAL '1 day'",
    };
  }

  return {
    label: "today",
    inbound: "call_date::date = CURRENT_DATE",
    outbound: "call_started_at::date = CURRENT_DATE",
  };
}

function hasBranchFilter(sql: string): boolean {
  return /branch_code/i.test(sql) || /cliniko_business_id/i.test(sql);
}

function isCountQuery(sql: string): boolean {
  return /inbound_calls|outbound_calls|count\s*\(\s*\*\s*\)/i.test(sql);
}

function isInboundOnlyQuestion(q: string): boolean {
  return /\b(inbound|incoming|received)\b/.test(q) && !/\b(outbound|outgoing|reminder)\b/.test(q);
}

function isOutboundOnlyQuestion(q: string): boolean {
  return /\b(outbound|outgoing|reminder)\b/.test(q) && !/\b(inbound|incoming|received)\b/.test(q);
}

function usesTodayAndYesterdayRange(sql: string): boolean {
  return (
    /CURRENT_DATE\s*-\s*INTERVAL\s*'1 day'/.test(sql) &&
    /<=\s*CURRENT_DATE/.test(sql)
  );
}

export function rebuildBranchCountSql(question: string, branch: BranchKey): string {
  const q = normalizeAnalyticsQuestion(question);
  const dates = detectDateRangeFromQuestion(question);
  const filter = BRANCH_FILTERS[branch];

  if (isInboundOnlyQuestion(q)) {
    return `SELECT COUNT(*)::int AS inbound_calls FROM onepoint.calls WHERE ${dates.inbound} AND ${filter}`;
  }
  if (isOutboundOnlyQuestion(q)) {
    return `SELECT COUNT(*)::int AS outbound_calls FROM onepoint.outbound_call_attempts WHERE ${dates.outbound} AND ${filter}`;
  }
  return `SELECT (SELECT COUNT(*)::int FROM onepoint.calls WHERE ${dates.inbound} AND ${filter}) AS inbound_calls, (SELECT COUNT(*)::int FROM onepoint.outbound_call_attempts WHERE ${dates.outbound} AND ${filter}) AS outbound_calls`;
}

function stripAccidentalBranchFilters(sql: string): string {
  return sql
    .replace(
      /\s+AND\s+\(LOWER\(TRIM\(branch_code::text\)\)\s*=\s*'[^']+'\s+OR\s+cliniko_business_id::text\s*=\s*'[^']+'\)/gi,
      "",
    )
    .replace(/\s+AND\s+LOWER\(TRIM\(branch_code::text\)\)\s*=\s*'[^']+'/gi, "")
    .replace(/\s+AND\s+cliniko_business_id::text\s*=\s*'[^']+'/gi, "");
}

/** Align LLM SQL with branch/date intent from the user's question. */
export function repairSqlFromQuestion(sql: string, question: string): string {
  const branch = detectBranchFromQuestion(question);
  const q = normalizeAnalyticsQuestion(question);

  if (!branch) {
    if (!/\bbranch\b/.test(q) && hasBranchFilter(sql)) {
      return stripAccidentalBranchFilters(sql);
    }
    return sql;
  }

  if (!isCountQuery(sql)) {
    return sql;
  }

  const dates = detectDateRangeFromQuestion(question);
  const needsBranchFilter = !hasBranchFilter(sql);
  const needsDateRangeFix =
    dates.label === "today_and_yesterday" && !usesTodayAndYesterdayRange(sql);

  if (needsBranchFilter || needsDateRangeFix) {
    return rebuildBranchCountSql(question, branch);
  }

  return sql;
}
