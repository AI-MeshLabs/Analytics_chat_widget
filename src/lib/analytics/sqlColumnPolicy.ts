/** Inbound table: onepoint.calls */
export const INBOUND_TABLE = "calls";
export const INBOUND_ALLOWED_COLUMNS = [
  "call_date",
  "status",
  "duration_secs",
  "branch_code",
  "branch_name",
  "cliniko_business_id",
] as const;

/** Outbound table: onepoint.outbound_call_attempts */
export const OUTBOUND_TABLE = "outbound_call_attempts";
export const OUTBOUND_ALLOWED_COLUMNS = [
  "call_started_at",
  "outcome",
  "duration_secs",
  "branch_code",
  "branch_name",
  "cliniko_business_id",
] as const;

export const ALLOWED_ANALYTICS_COLUMNS = [
  ...INBOUND_ALLOWED_COLUMNS,
  ...OUTBOUND_ALLOWED_COLUMNS,
] as const;

/** Columns that must never appear in generated SQL. */
export const FORBIDDEN_COLUMN_REFERENCES = [
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
] as const;

const FORBIDDEN_ROW_KEYS = new Set<string>([...FORBIDDEN_COLUMN_REFERENCES, "call_data"]);

export class ReadonlySqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadonlySqlValidationError";
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function referencesInboundTable(sql: string, schema: string): boolean {
  const lowered = sql.toLowerCase();
  const schemaPrefix = `${schema.toLowerCase()}.`;
  return (
    lowered.includes(`${schemaPrefix}${INBOUND_TABLE}`) ||
    /\bfrom\s+calls\b/.test(lowered) ||
    /\bjoin\s+calls\b/.test(lowered)
  );
}

export function referencesOutboundTable(sql: string, schema: string): boolean {
  const lowered = sql.toLowerCase();
  const schemaPrefix = `${schema.toLowerCase()}.`;
  return (
    lowered.includes(`${schemaPrefix}${OUTBOUND_TABLE}`) ||
    /\bfrom\s+outbound_call_attempts\b/.test(lowered) ||
    /\bjoin\s+outbound_call_attempts\b/.test(lowered)
  );
}

export function validateAllowedAnalyticsTables(sql: string, schema: string): void {
  if (!referencesInboundTable(sql, schema) && !referencesOutboundTable(sql, schema)) {
    throw new ReadonlySqlValidationError(
      `Query must read from ${schema}.${INBOUND_TABLE} and/or ${schema}.${OUTBOUND_TABLE}.`,
    );
  }

  const schemaLower = schema.toLowerCase();
  const allowedTargets = new Set([
    "calls",
    `${schemaLower}.calls`,
    OUTBOUND_TABLE,
    `${schemaLower}.${OUTBOUND_TABLE}`,
  ]);

  const fromJoinMatches = [...sql.matchAll(/\b(?:from|join)\s+("?[a-z0-9_.]+"?)/gi)];
  for (const match of fromJoinMatches) {
    const target = match[1]?.replace(/"/g, "").trim().toLowerCase() ?? "";
    if (!target || allowedTargets.has(target)) continue;
    throw new ReadonlySqlValidationError(
      `Table "${target}" is not allowed. Use only ${schema}.${INBOUND_TABLE} and ${schema}.${OUTBOUND_TABLE}.`,
    );
  }
}

export function validateAllowedCallColumns(sql: string): void {
  const lowered = sql.toLowerCase();

  if (/\bselect\s+(?:distinct\s+)?(?:\w+\.)?\*/.test(lowered)) {
    throw new ReadonlySqlValidationError(
      `SELECT * is not allowed. Use only: ${ALLOWED_ANALYTICS_COLUMNS.join(", ")}.`,
    );
  }

  for (const column of FORBIDDEN_COLUMN_REFERENCES) {
    if (new RegExp(`\\b${escapeRegExp(column)}\\b`, "i").test(sql)) {
      throw new ReadonlySqlValidationError(
        `Column "${column}" is not allowed. Inbound (${INBOUND_TABLE}): ${INBOUND_ALLOWED_COLUMNS.join(", ")}. Outbound (${OUTBOUND_TABLE}): ${OUTBOUND_ALLOWED_COLUMNS.join(", ")}.`,
      );
    }
  }
}

export function sanitizeReadonlySqlRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return rows.map((row) => {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (!FORBIDDEN_ROW_KEYS.has(key.toLowerCase())) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  });
}
