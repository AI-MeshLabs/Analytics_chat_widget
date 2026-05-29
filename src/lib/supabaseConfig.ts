const DEFAULT_DB_SCHEMA = "onepoint";

/** Postgres / Supabase schema name (e.g. onepoint). Set via SUPABASE_DB_SCHEMA in .env */
export function getAnalyticsSchema(): string {
  const schema = process.env.SUPABASE_DB_SCHEMA?.trim();
  if (!schema) return DEFAULT_DB_SCHEMA;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error("SUPABASE_DB_SCHEMA must be a valid identifier (letters, numbers, underscore).");
  }
  return schema;
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("SUPABASE_URL must be configured.");
  }
  return url;
}

export function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured.");
  }
  return key;
}

export function getSupabaseProjectRef(): string | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  if (!supabaseUrl) return null;
  const match = supabaseUrl.match(/https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match?.[1] ?? null;
}

function buildProjectDbUrlFromSupabaseEnv(): string | null {
  const password =
    process.env.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.PROJECTDB_PASSWORD?.trim() ||
    process.env.POSTGRES_PASSWORD?.trim();
  const ref = getSupabaseProjectRef();
  if (!password || !ref) return null;

  const poolerHost = process.env.SUPABASE_POOLER_HOST?.trim();
  if (poolerHost) {
    const port = process.env.SUPABASE_POOLER_PORT?.trim() || "6543";
    return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres`;
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

/** Supabase pooler requires username postgres.[project-ref], not plain postgres. */
export function normalizeProjectDbUrl(connectionString: string): string {
  const url = new URL(connectionString);
  const ref = getSupabaseProjectRef();

  if (url.hostname.includes(".pooler.supabase.com") && url.username === "postgres" && ref) {
    url.username = `postgres.${ref}`;
  }

  return url.toString();
}

function stripEnvQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Direct Postgres URL for n8n read-only SQL (not the Supabase REST API). */
export function getProjectDbUrl(): string {
  const explicit = stripEnvQuotes(
    process.env.PROJECTDB_URL?.trim() ||
      process.env.DATABASE_URL?.trim() ||
      process.env.SUPABASE_DATABASE_URL?.trim() ||
      "",
  );

  if (explicit) return normalizeProjectDbUrl(explicit);

  const derived = buildProjectDbUrlFromSupabaseEnv();
  if (derived) return normalizeProjectDbUrl(derived);

  throw new Error(
    "Database URL missing. Set PROJECTDB_URL in .env (Supabase pooler: postgresql://postgres.PROJECT_REF:PASSWORD@....pooler.supabase.com:6543/postgres), " +
      "or set SUPABASE_URL plus SUPABASE_DB_PASSWORD.",
  );
}
