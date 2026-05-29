import dns from "node:dns";
import { lookup } from "node:dns/promises";
import { Pool, type PoolConfig, type QueryResultRow } from "pg";
import {
  getAnalyticsSchema,
  getProjectDbUrl,
  getSupabaseProjectRef,
} from "@/lib/supabaseConfig";

/** VPS hosts often lack IPv6 routes; Supabase DB DNS may prefer IPv6 and fail with ENETUNREACH. */
dns.setDefaultResultOrder("ipv4first");

const BLOCKED_KEYWORD_PATTERN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute|copy|merge|into)\b/i;

const AGGREGATE_OR_LIMIT_PATTERN =
  /\b(count|avg|sum|min|max|group\s+by|limit)\b/i;

const DEFAULT_ROW_LIMIT = 100;

let poolSingleton: Pool | null = null;
let poolInitPromise: Promise<Pool> | null = null;

export type N8nSqlSuccess = {
  success: true;
  rows: QueryResultRow[];
  rowCount: number;
};

export type N8nSqlFailure = {
  success: false;
  error: string;
};

export type N8nSqlResult = N8nSqlSuccess | N8nSqlFailure;

function isIpv4Host(host: string): boolean {
  return host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

async function buildPoolConfig(connectionString: string): Promise<PoolConfig> {
  const url = new URL(connectionString);
  let host = url.hostname;
  const ssl = host.includes("localhost") ? undefined : { rejectUnauthorized: false };

  if (!isIpv4Host(host)) {
    try {
      const { address } = await lookup(host, { family: 4 });
      host = address;
    } catch {
      host = url.hostname;
    }
  }

  let user = decodeURIComponent(url.username);
  const ref = getSupabaseProjectRef();
  if (host.includes(".pooler.supabase.com") || url.hostname.includes(".pooler.supabase.com")) {
    if (user === "postgres" && ref) {
      user = `postgres.${ref}`;
    } else if (ref && !user.includes(".") && user.startsWith("postgres")) {
      user = `postgres.${ref}`;
    }
  }

  const database = (url.pathname.replace(/^\//, "") || "postgres").toLowerCase();

  // Use discrete fields — libpq can mis-parse usernames with dots in a connection URI.
  return {
    max: 5,
    ssl,
    host,
    port: Number(url.port || 5432),
    user,
    password: decodeURIComponent(url.password),
    database,
  };
}

async function getPool(): Promise<Pool> {
  if (poolSingleton) return poolSingleton;
  if (!poolInitPromise) {
    poolInitPromise = (async () => {
      const connectionString = getProjectDbUrl();
      const pool = new Pool(await buildPoolConfig(connectionString));
      poolSingleton = pool;
      return pool;
    })();
  }
  return poolInitPromise;
}

function normalizeSqlInput(sql: unknown): string {
  if (typeof sql !== "string") {
    throw new N8nSqlValidationError("The 'sql' field is required and must be a string.");
  }
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new N8nSqlValidationError("The 'sql' field cannot be empty.");
  }
  return trimmed;
}

export class N8nSqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "N8nSqlValidationError";
  }
}

export function validateAndPrepareReadOnlySql(rawSql: string): string {
  let sql = rawSql.replace(/\s+/g, " ").trim();

  if (sql.endsWith(";")) {
    sql = sql.slice(0, -1).trim();
  }

  if (sql.includes(";")) {
    throw new N8nSqlValidationError("Multiple SQL statements are not allowed.");
  }

  const lowered = sql.toLowerCase();
  if (!lowered.startsWith("select")) {
    throw new N8nSqlValidationError("Only SELECT queries are allowed.");
  }

  if (BLOCKED_KEYWORD_PATTERN.test(lowered)) {
    throw new N8nSqlValidationError("Query contains a disallowed SQL keyword.");
  }

  const schema = getAnalyticsSchema().toLowerCase();
  const referencesAllowedSchema =
    lowered.includes(`${schema}.`) ||
    lowered.includes(`from ${schema}`) ||
    lowered.includes(`join ${schema}`);
  const referencesPublicCalls =
    lowered.includes("from calls") || lowered.includes("join calls");

  if (!referencesAllowedSchema && !referencesPublicCalls) {
    throw new N8nSqlValidationError(
      `Query must read from ${getAnalyticsSchema()} schema tables (e.g. ${getAnalyticsSchema()}.calls).`,
    );
  }

  if (!AGGREGATE_OR_LIMIT_PATTERN.test(lowered)) {
    sql = `${sql} LIMIT ${DEFAULT_ROW_LIMIT}`;
  }

  return sql;
}

export async function executeN8nReadOnlySql(sqlInput: unknown): Promise<N8nSqlResult> {
  try {
    const normalized = normalizeSqlInput(sqlInput);
    const preparedSql = validateAndPrepareReadOnlySql(normalized);
    const pool = await getPool();

    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '30000'");
      const result = await client.query(preparedSql);
      await client.query("COMMIT");

      const rows = result.rows ?? [];
      return {
        success: true,
        rows,
        rowCount: rows.length,
      };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof N8nSqlValidationError) {
      return { success: false, error: error.message };
    }
    const message = error instanceof Error ? error.message : "Query execution failed.";
    if (/password authentication failed/i.test(message) && /user "postgres"/i.test(message)) {
      return {
        success: false,
        error:
          `${message} — Supabase pooler requires username postgres.[project-ref] (e.g. postgres.xweuzpdzcrjrkzcsruxc), not "postgres". Copy the full URI from Supabase → Database → Connection pooling.`,
      };
    }
    return { success: false, error: message };
  }
}
