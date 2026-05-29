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

function getSupabaseProjectRef(): string | null {
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
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

/** Direct Postgres URL for n8n read-only SQL (not the Supabase REST API). */
export function getProjectDbUrl(): string {
  const explicit =
    process.env.PROJECTDB_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const derived = buildProjectDbUrlFromSupabaseEnv();
  if (derived) return derived;

  throw new Error(
    "Database URL missing. Set PROJECTDB_URL in .env (postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres), " +
      "or set SUPABASE_URL plus SUPABASE_DB_PASSWORD.",
  );
}
