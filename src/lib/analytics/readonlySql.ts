import { getSupabaseClient } from "@/lib/db";
import { getAnalyticsSchema } from "@/lib/supabaseConfig";
import {
  ReadonlySqlValidationError,
  sanitizeReadonlySqlRows,
  validateAllowedCallColumns,
} from "@/lib/analytics/sqlColumnPolicy";

const BLOCKED_KEYWORD_PATTERN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute|copy|merge|into)\b/i;

const AGGREGATE_OR_LIMIT_PATTERN =
  /\b(count|avg|sum|min|max|group\s+by|limit)\b/i;

const DEFAULT_ROW_LIMIT = 100;
const DEFAULT_READONLY_SQL_RPC = "analytics_readonly_sql";

export type ReadonlySqlRow = Record<string, unknown>;

export type ReadonlySqlSuccess = {
  success: true;
  rows: ReadonlySqlRow[];
  rowCount: number;
};

export type ReadonlySqlFailure = {
  success: false;
  error: string;
};

export type ReadonlySqlResult = ReadonlySqlSuccess | ReadonlySqlFailure;

function getReadonlySqlRpcName(): string {
  const name = process.env.SUPABASE_READONLY_SQL_RPC?.trim();
  return name || DEFAULT_READONLY_SQL_RPC;
}

function normalizeSqlInput(sql: unknown): string {
  if (typeof sql !== "string") {
    throw new ReadonlySqlValidationError("The 'sql' field is required and must be a string.");
  }
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new ReadonlySqlValidationError("The 'sql' field cannot be empty.");
  }
  return trimmed;
}

export { ReadonlySqlValidationError } from "@/lib/analytics/sqlColumnPolicy";

export function validateAndPrepareReadOnlySql(rawSql: string): string {
  let sql = rawSql.replace(/\s+/g, " ").trim();

  if (sql.endsWith(";")) {
    sql = sql.slice(0, -1).trim();
  }

  if (sql.includes(";")) {
    throw new ReadonlySqlValidationError("Multiple SQL statements are not allowed.");
  }

  const lowered = sql.toLowerCase();
  if (!lowered.startsWith("select")) {
    throw new ReadonlySqlValidationError("Only SELECT queries are allowed.");
  }

  if (BLOCKED_KEYWORD_PATTERN.test(lowered)) {
    throw new ReadonlySqlValidationError("Query contains a disallowed SQL keyword.");
  }

  const schema = getAnalyticsSchema().toLowerCase();
  if (lowered.includes("call_data")) {
    throw new ReadonlySqlValidationError(
      `Query must read only from ${getAnalyticsSchema()}.calls (call_data is not allowed).`,
    );
  }

  const referencesCalls =
    lowered.includes(`${schema}.calls`) ||
    lowered.includes(`from ${schema}.calls`) ||
    lowered.includes(`join ${schema}.calls`) ||
    lowered.includes("from calls") ||
    lowered.includes("join calls");

  if (!referencesCalls) {
    throw new ReadonlySqlValidationError(
      `Query must read from ${getAnalyticsSchema()}.calls only (e.g. SELECT ... FROM ${getAnalyticsSchema()}.calls).`,
    );
  }

  validateAllowedCallColumns(sql);

  if (!AGGREGATE_OR_LIMIT_PATTERN.test(lowered)) {
    sql = `${sql} LIMIT ${DEFAULT_ROW_LIMIT}`;
  }

  return sql;
}

function normalizeRpcRows(data: unknown): ReadonlySqlRow[] {
  if (data == null) return [];
  if (!Array.isArray(data)) {
    if (typeof data === "object") return [data as ReadonlySqlRow];
    return [{ value: data }];
  }
  return data.map((row) => {
    if (typeof row === "object" && row !== null && !Array.isArray(row)) {
      return row as ReadonlySqlRow;
    }
    return { value: row };
  });
}

export async function executeReadonlySql(sqlInput: unknown): Promise<ReadonlySqlResult> {
  try {
    const normalized = normalizeSqlInput(sqlInput);
    const preparedSql = validateAndPrepareReadOnlySql(normalized);
    const rpcName = getReadonlySqlRpcName();

    const { data, error } = await getSupabaseClient().rpc(rpcName, {
      query_sql: preparedSql,
    });

    if (error) {
      const message = error.message ?? "Query execution failed.";
      if (/function.*does not exist|could not find the function/i.test(message)) {
        return {
          success: false,
          error: `${message} Run scripts/analytics_readonly_sql.sql in the Supabase SQL editor to enable read-only SQL via the API.`,
        };
      }
      return { success: false, error: message };
    }

    const rows = sanitizeReadonlySqlRows(normalizeRpcRows(data));
    return {
      success: true,
      rows,
      rowCount: rows.length,
    };
  } catch (error) {
    if (error instanceof ReadonlySqlValidationError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "Query execution failed.";
    return { success: false, error: message };
  }
}
