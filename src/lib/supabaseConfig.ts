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
