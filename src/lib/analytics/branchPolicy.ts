import { detectBranchFromQuestion, normalizeAnalyticsQuestion } from "@/lib/analytics/sqlQuestionRepair";

export const KNOWN_BRANCH_LABELS = ["Ryde", "Springwood"] as const;

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

function titleCaseBranch(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Returns a display name when the question names a branch we do not track. */
export function detectUnknownBranchFromQuestion(question: string): string | null {
  if (detectBranchFromQuestion(question)) {
    return null;
  }

  const q = normalizeAnalyticsQuestion(question);
  const mentionsBranchContext =
    /\bbranch\b/.test(q) || /\b(?:in|at)\s+(?:onepoint\s+)?[a-z]/.test(q);

  if (!mentionsBranchContext) {
    return null;
  }

  const patterns = [
    /\b(?:in|at)\s+(?:onepoint\s+)?([a-z][a-z\s-]*?)\s+branch\b/,
    /\b([a-z][a-z\s-]*?)\s+branch\b/,
    /\b(?:in|at)\s+(?:onepoint\s+)?([a-z][a-z-]{3,})\b(?=.*\bcalls?\b)/,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (!match?.[1]) continue;

    const candidate = match[1].trim().replace(/\s+/g, " ");
    if (!candidate || NON_BRANCH_WORDS.has(candidate)) continue;
    if (candidate === "ryde" || candidate === "springwood") continue;
    if (/^\d/.test(candidate)) continue;

    return titleCaseBranch(candidate);
  }

  return null;
}

export function unknownBranchMessage(branchName: string): string {
  return `I can only provide branch-specific call analytics for **${KNOWN_BRANCH_LABELS.join("** and **")}**. **${branchName}** is not a tracked branch in our call data.`;
}
