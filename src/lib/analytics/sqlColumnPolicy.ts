/** Columns n8n / read-only SQL may reference on onepoint.calls. */
export const ALLOWED_CALL_COLUMNS = ["call_date", "duration_secs", "status"] as const;

/** Known onepoint.calls columns that must not appear in generated SQL. */
export const FORBIDDEN_CALL_COLUMN_REFERENCES = [
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

const FORBIDDEN_ROW_KEYS = new Set<string>([
  ...FORBIDDEN_CALL_COLUMN_REFERENCES,
  "call_data",
]);

export class ReadonlySqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadonlySqlValidationError";
  }
}

export function validateAllowedCallColumns(sql: string): void {
  const lowered = sql.toLowerCase();

  if (/\bselect\s+(?:distinct\s+)?(?:\w+\.)?\*/.test(lowered)) {
    throw new ReadonlySqlValidationError(
      `SELECT * is not allowed. Use only: ${ALLOWED_CALL_COLUMNS.join(", ")}.`,
    );
  }

  for (const column of FORBIDDEN_CALL_COLUMN_REFERENCES) {
    if (new RegExp(`\\b${column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sql)) {
      throw new ReadonlySqlValidationError(
        `Column "${column}" is not allowed. Use only: ${ALLOWED_CALL_COLUMNS.join(", ")}.`,
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
