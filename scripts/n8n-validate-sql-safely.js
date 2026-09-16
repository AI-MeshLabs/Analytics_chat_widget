/**
 * Paste into n8n "validate sql safely" Code node.
 * Fixes branch detection for "spring wood" and rebuilds count SQL when branch/date filters are missing.
 */

const KNOWN_BRANCH_LABELS = ["Ryde", "Springwood"];

const NON_BRANCH_WORDS = new Set([
  "today",
  "yesterday",
  "week",
  "month",
  "the",
  "this",
  "last",
  "made",
  "call",
  "calls",
  "inbound",
  "outbound",
  "average",
  "duration",
  "failed",
  "unsuccessful",
  "total",
  "number",
  "how",
  "many",
  "onepoint",
  "branch",
  "branches",
  "and",
  "for",
  "at",
  "in",
  "of",
  "on",
  "per",
  "all",
  "tracked",
  "lines",
]);

function titleCaseBranch(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function detectUnknownBranch(question) {
  if (detectBranch(question)) return null;

  const q = normalizeQuestion(question);
  const mentionsBranchContext =
    /\bbranch\b/.test(q) || /\b(?:in|at)\s+(?:onepoint\s+)?[a-z]/.test(q);

  if (!mentionsBranchContext) return null;

  const patterns = [
    /\b(?:in|at)\s+(?:onepoint\s+)?([a-z][a-z\s-]*?)\s+branch\b/,
    /\b([a-z][a-z\s-]*?)\s+branch\b/,
    /\b(?:in|at)\s+(?:onepoint\s+)?([a-z][a-z-]{3,})\b(?=.*\bcalls?\b)/,
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = q.match(patterns[i]);
    if (!match || !match[1]) continue;

    const candidate = match[1].trim().replace(/\s+/g, " ");
    if (!candidate || NON_BRANCH_WORDS.has(candidate)) continue;
    if (candidate === "ryde" || candidate === "springwood") continue;
    if (/^\d/.test(candidate)) continue;

    return titleCaseBranch(candidate);
  }

  return null;
}

function unknownBranchMessage(branchName) {
  return (
    "I can only provide branch-specific call analytics for **" +
    KNOWN_BRANCH_LABELS.join("** and **") +
    "**. **" +
    branchName +
    "** is not a tracked branch in our call data."
  );
}

const BRANCH_FILTERS = {
  ryde: "(LOWER(TRIM(branch_code::text)) = 'ryde' OR cliniko_business_id::text = '1948378953639014361')",
  springwood:
    "(LOWER(TRIM(branch_code::text)) = 'springwood' OR cliniko_business_id::text = '1102355493780725293')",
};

function normalizeQuestion(question) {
  return String(question)
    .toLowerCase()
    .replace(/\bonepoint\s+/g, "")
    .replace(/\bspring\s*wood\b/g, "springwood")
    .replace(/\s+/g, " ")
    .trim();
}

function detectBranch(question) {
  const q = normalizeQuestion(question);
  if (/\bryde\b/.test(q)) return "ryde";
  if (/\bspringwood\b/.test(q)) return "springwood";
  return null;
}

function detectDateRange(question) {
  const q = normalizeQuestion(question);

  if (/today\s+and\s+yesterday|yesterday\s+and\s+today/.test(q)) {
    return {
      label: "today_and_yesterday",
      inbound:
        "call_date::date >= CURRENT_DATE - INTERVAL '1 day' AND call_date::date <= CURRENT_DATE",
      outbound:
        "call_started_at::date >= CURRENT_DATE - INTERVAL '1 day' AND call_started_at::date <= CURRENT_DATE",
    };
  }
  if (/\blast week\b|\bprevious week\b|\bpast week\b/.test(q)) {
    return {
      label: "last_week",
      inbound:
        "call_date >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND call_date < DATE_TRUNC('week', CURRENT_DATE)",
      outbound:
        "call_started_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND call_started_at < DATE_TRUNC('week', CURRENT_DATE)",
    };
  }
  if (/\bthis week\b|\bweekly\b/.test(q)) {
    return {
      label: "this_week",
      inbound: "call_date >= DATE_TRUNC('week', CURRENT_DATE)",
      outbound: "call_started_at >= DATE_TRUNC('week', CURRENT_DATE)",
    };
  }
  if (/\blast month\b|\bprevious month\b/.test(q)) {
    return {
      label: "last_month",
      inbound:
        "call_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND call_date < DATE_TRUNC('month', CURRENT_DATE)",
      outbound:
        "call_started_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND call_started_at < DATE_TRUNC('month', CURRENT_DATE)",
    };
  }
  if (/\bthis month\b|\bmonthly\b/.test(q)) {
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

function hasBranchFilter(sql) {
  return /branch_code/i.test(sql) || /cliniko_business_id/i.test(sql);
}

function isCountQuery(sql) {
  return /inbound_calls|outbound_calls|count\s*\(\s*\*\s*\)/i.test(sql);
}

function isInboundOnly(q) {
  return /\b(inbound|incoming|received)\b/.test(q) && !/\b(outbound|outgoing|reminder)\b/.test(q);
}

function isOutboundOnly(q) {
  return /\b(outbound|outgoing|reminder)\b/.test(q) && !/\b(inbound|incoming|received)\b/.test(q);
}

function usesTodayAndYesterdayRange(sql) {
  return (
    /CURRENT_DATE\s*-\s*INTERVAL\s*'1 day'/.test(sql) && /<=\s*CURRENT_DATE/.test(sql)
  );
}

function rebuildBranchCountSql(question, branch) {
  const q = normalizeQuestion(question);
  const dates = detectDateRange(question);
  const filter = BRANCH_FILTERS[branch];

  if (isInboundOnly(q)) {
    return `SELECT COUNT(*)::int AS inbound_calls FROM onepoint.calls WHERE ${dates.inbound} AND ${filter}`;
  }
  if (isOutboundOnly(q)) {
    return `SELECT COUNT(*)::int AS outbound_calls FROM onepoint.outbound_call_attempts WHERE ${dates.outbound} AND ${filter}`;
  }
  return `SELECT (SELECT COUNT(*)::int FROM onepoint.calls WHERE ${dates.inbound} AND ${filter}) AS inbound_calls, (SELECT COUNT(*)::int FROM onepoint.outbound_call_attempts WHERE ${dates.outbound} AND ${filter}) AS outbound_calls`;
}

function repairSqlFromQuestion(sql, question) {
  const branch = detectBranch(question);
  const q = normalizeQuestion(question);

  if (!branch) {
    if (!/\bbranch\b/.test(q) && hasBranchFilter(sql)) {
      return sql
        .replace(
          /\s+AND\s+\(LOWER\(TRIM\(branch_code::text\)\)\s*=\s*'[^']+'\s+OR\s+cliniko_business_id::text\s*=\s*'[^']+'\)/gi,
          "",
        )
        .replace(/\s+AND\s+LOWER\(TRIM\(branch_code::text\)\)\s*=\s*'[^']+'/gi, "")
        .replace(/\s+AND\s+cliniko_business_id::text\s*=\s*'[^']+'/gi, "");
    }
    return sql;
  }

  if (!isCountQuery(sql)) return sql;

  const dates = detectDateRange(question);
  const needsBranchFilter = !hasBranchFilter(sql);
  const needsDateRangeFix =
    dates.label === "today_and_yesterday" && !usesTodayAndYesterdayRange(sql);

  if (needsBranchFilter || needsDateRangeFix) {
    return rebuildBranchCountSql(question, branch);
  }

  return sql;
}

const question = String($("validate input").first().json.question ?? "");
const unknownBranch = detectUnknownBranch(question);
if (unknownBranch) {
  throw new Error(unknownBranchMessage(unknownBranch));
}

const normalizedQuestion = normalizeQuestion(question);
const input = $input.first().json;

const raw =
  input.sql ??
  input.output?.[0]?.content?.[0]?.text ??
  input.content?.[0]?.text ??
  input.message?.content ??
  input.text ??
  "";

let sql = String(raw).trim();
sql = sql.replace(/^```(?:sql)?\s*/i, "").replace(/\s*```$/i, "").trim();

const selectIdx = sql.toLowerCase().indexOf("select");
if (selectIdx > 0) sql = sql.slice(selectIdx).trim();
if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
sql = sql.replace(/\s+/g, " ").trim();

sql = sql.replace(
  /\bFROM\s+(onepoint\.(?:calls|outbound_call_attempts)|calls|outbound_call_attempts)\s+AND\b/gi,
  (_m, table) => "FROM " + table + " WHERE",
);

sql = repairSqlFromQuestion(sql, question);

const referencesInbound = /\bonepoint\.calls\b|\bfrom\s+calls\b|\bjoin\s+calls\b/i.test(sql);
const referencesOutbound =
  /\bonepoint\.outbound_call_attempts\b|\bfrom\s+outbound_call_attempts\b|\bjoin\s+outbound_call_attempts\b/i.test(
    sql,
  );

if (!/^select\s/i.test(sql)) {
  throw new Error("Only SELECT queries are allowed.");
}

if (/\bselect\s+\*/i.test(sql)) {
  throw new Error("SELECT * is not allowed.");
}

if (!referencesInbound && !referencesOutbound) {
  throw new Error("Query must use onepoint.calls and/or onepoint.outbound_call_attempts.");
}

const forbiddenTables = [...sql.matchAll(/\b(?:from|join)\s+("?[a-z0-9_.]+"?)/gi)]
  .map((m) => m[1].replace(/"/g, "").trim().toLowerCase())
  .filter(function (t) {
    return (
      t &&
      t !== "calls" &&
      t !== "onepoint.calls" &&
      t !== "outbound_call_attempts" &&
      t !== "onepoint.outbound_call_attempts"
    );
  });

if (forbiddenTables.length > 0) {
  throw new Error('Table "' + forbiddenTables[0] + '" is not allowed.');
}

const isInboundOnlyQuestion = /\b(inbound|incoming|received)\b/.test(normalizedQuestion);
const isOutboundOnlyQuestion = /\b(outbound|outgoing|reminder)\b/.test(normalizedQuestion);

if (isInboundOnlyQuestion && referencesOutbound && !referencesInbound) {
  throw new Error("Inbound question must query onepoint.calls only.");
}

if (isOutboundOnlyQuestion && referencesInbound && !referencesOutbound) {
  throw new Error("Outbound question must query onepoint.outbound_call_attempts only.");
}

const branch = detectBranch(question);
const asksAnyBranch = branch !== null || /\bbranch\b/.test(normalizedQuestion);

if (branch && !hasBranchFilter(sql)) {
  throw new Error(branch + " branch questions must filter by branch_code or cliniko_business_id.");
}

const forbiddenColumns = [
  "id",
  "name",
  "email",
  "summary",
  "credits",
  "end_time",
  "start_time",
  "booking_practitioner",
  "call_type",
  "created_at",
  "updated_at",
  "duration_seconds",
  "transcript",
  "call_id",
  "agent_name",
  "disposition",
  "phone",
  "recording",
  "message",
  "notes",
  "body",
  "content",
  "metadata",
  "call_data",
  "patient_name",
];

for (let i = 0; i < forbiddenColumns.length; i++) {
  const col = forbiddenColumns[i];
  const re = new RegExp("\\b" + col + "\\b", "i");
  if (re.test(sql)) {
    throw new Error('Column "' + col + '" is not allowed.');
  }
}

const blocked = /\b(insert|update|delete|drop|alter|create|truncate|copy|merge|execute|grant|revoke|into)\b/i;
if (blocked.test(sql)) {
  throw new Error("Query contains a blocked SQL keyword.");
}

return [
  {
    json: {
      error: false,
      question: $("validate input").first().json.question,
      sql: sql,
    },
  },
];
