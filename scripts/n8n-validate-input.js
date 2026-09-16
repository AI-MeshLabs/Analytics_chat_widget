/**
 * Paste into n8n "validate input" Code node.
 * Blocks unknown branch names before SQL is generated.
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

function normalizeQuestion(question) {
  return String(question)
    .toLowerCase()
    .replace(/\bonepoint\s+/g, "")
    .replace(/\bspring\s*wood\b/g, "springwood")
    .replace(/\s+/g, " ")
    .trim();
}

function detectKnownBranch(question) {
  const q = normalizeQuestion(question);
  if (/\bryde\b/.test(q)) return "ryde";
  if (/\bspringwood\b/.test(q)) return "springwood";
  return null;
}

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
  if (detectKnownBranch(question)) return null;

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

const item = $input.first().json;

const question = String(item.question ?? item.body?.question ?? "").trim();
const q = question.toLowerCase();

const allowedKeywords = [
  "call",
  "calls",
  "duration",
  "average",
  "avg",
  "secs",
  "seconds",
  "status",
  "failed",
  "unsuccessful",
  "missed",
  "branch",
  "branches",
  "ryde",
  "springwood",
  "onepoint",
];

const isAllowed = allowedKeywords.some(function (word) {
  return q.includes(word);
});

if (!question) {
  return [
    {
      json: {
        error: true,
        answer: "Question is required.",
        message: "Question is required.",
      },
    },
  ];
}

const unknownBranch = detectUnknownBranch(question);
if (unknownBranch) {
  const reply = unknownBranchMessage(unknownBranch);
  return [
    {
      json: {
        error: true,
        answer: reply,
        message: reply,
      },
    },
  ];
}

if (!isAllowed) {
  return [
    {
      json: {
        error: true,
        answer:
          "I can only help with questions like calls made today, average call duration, unsuccessful calls, and branch-specific call counts.",
        message:
          "I can only help with questions like calls made today, average call duration, unsuccessful calls, and branch-specific call counts.",
      },
    },
  ];
}

return [
  {
    json: {
      error: false,
      question: question,
    },
  },
];
