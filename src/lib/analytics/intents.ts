export type AnalyticsIntent =
  | "calls_today"
  | "calls_this_week"
  | "average_duration"
  | "unsuccessful_calls"
  | "calls_by_day"
  | "calls_by_agent"
  | "top_dispositions"
  | "longest_calls"
  | "call_status_summary"
  | "unknown";

const CALL_ANALYTICS_TERMS = [
  "call",
  "calls",
  "call records",
  "duration",
  "agent",
  "disposition",
  "status",
  "missed",
  "failed",
  "trend",
  "analytics",
  "summary",
];

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function isCallAnalyticsQuestion(text: string) {
  return includesAny(text, CALL_ANALYTICS_TERMS);
}

export function getAnalyticsIntent(question: string): AnalyticsIntent {
  const normalized = question.trim().toLowerCase();
  if (!normalized) return "unknown";

  // Guardrail: unrelated questions must not be treated as analytics intents.
  if (!isCallAnalyticsQuestion(normalized)) {
    return "unknown";
  }

  if (includesAny(normalized, ["status summary", "call status", "status breakdown"])) {
    return "call_status_summary";
  }

  if (
    includesAny(normalized, ["average duration", "avg duration", "average call length", "mean duration"]) &&
    includesAny(normalized, ["call", "calls", "duration"])
  ) {
    return "average_duration";
  }

  if (
    includesAny(normalized, ["average", "avg", "mean"]) &&
    includesAny(normalized, ["call duration", "duration", "call length"])
  ) {
    return "average_duration";
  }

  if (includesAny(normalized, ["unsuccessful", "failed", "missed", "dropped", "incomplete"]) && includesAny(normalized, ["call", "calls"])) {
    return "unsuccessful_calls";
  }

  if (
    includesAny(normalized, ["calls by day", "daily calls", "day wise", "day-wise"]) &&
    includesAny(normalized, ["call", "calls"])
  ) {
    return "calls_by_day";
  }

  if (
    includesAny(normalized, ["calls by agent", "agent performance", "per agent", "agent wise", "agent-wise"]) &&
    includesAny(normalized, ["call", "calls", "agent"])
  ) {
    return "calls_by_agent";
  }

  if (includesAny(normalized, ["top dispositions", "common dispositions", "disposition summary"])) {
    return "top_dispositions";
  }

  if (includesAny(normalized, ["longest calls", "long calls", "max duration", "longest duration"])) {
    return "longest_calls";
  }

  if (
    includesAny(normalized, ["number of calls", "how many calls", "total calls", "calls made", "call volume", "call records"]) &&
    includesAny(normalized, ["call", "calls"])
  ) {
    return "calls_today";
  }

  if (
    includesAny(normalized, ["calls this week", "weekly calls", "this week"]) &&
    includesAny(normalized, ["call", "calls"])
  ) {
    return "calls_this_week";
  }

  if (
    includesAny(normalized, ["calls today", "today calls"]) ||
    (normalized.includes("today") && normalized.includes("call"))
  ) {
    return "calls_today";
  }

  return "unknown";
}
