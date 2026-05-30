-- Run once in Supabase → SQL Editor.
-- Enables POST /api/analytics-chat/sql { "sql": "SELECT ..." } via analytics_readonly_sql RPC.
-- Re-run after updates to apply column restrictions.

CREATE OR REPLACE FUNCTION public.analytics_readonly_sql(query_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  lowered text;
  result jsonb;
  forbidden_cols text[] := ARRAY[
    'id', 'name', 'email', 'summary', 'credits', 'end_time', 'start_time',
    'booking_practitioner', 'call_type', 'created_at', 'updated_at',
    'duration_seconds', 'transcript', 'call_id', 'agent_name', 'disposition',
    'phone', 'recording', 'message', 'notes', 'body', 'content', 'metadata'
  ];
  col text;
BEGIN
  normalized := trim(both from regexp_replace(query_sql, '\s+', ' ', 'g'));
  lowered := lower(normalized);

  IF normalized = '' THEN
    RAISE EXCEPTION 'The sql field cannot be empty.';
  END IF;

  IF position(';' in normalized) > 0 THEN
    RAISE EXCEPTION 'Multiple SQL statements are not allowed.';
  END IF;

  IF lowered !~ '^select' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed.';
  END IF;

  IF lowered ~ '\y(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute|copy|merge|into)\y' THEN
    RAISE EXCEPTION 'Query contains a disallowed SQL keyword.';
  END IF;

  IF lowered ~ 'call_data' THEN
    RAISE EXCEPTION 'Query must read only from onepoint.calls (call_data is not allowed).';
  END IF;

  IF lowered !~ '(onepoint\.calls|from onepoint\.calls|join onepoint\.calls|from calls|join calls)' THEN
    RAISE EXCEPTION 'Query must read from onepoint.calls only (e.g. SELECT ... FROM onepoint.calls).';
  END IF;

  IF lowered ~ '\mselect\s+(distinct\s+)?(\w+\.)?\*\M' THEN
    RAISE EXCEPTION 'SELECT * is not allowed. Use only call_date, duration_secs, status.';
  END IF;

  FOREACH col IN ARRAY forbidden_cols LOOP
    IF lowered ~ ('\m' || col || '\M') THEN
      RAISE EXCEPTION 'Column "%" is not allowed. Use only call_date, duration_secs, status.', col;
    END IF;
  END LOOP;

  PERFORM set_config('statement_timeout', '30000', true);

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(row_to_json(sub)), ''[]''::jsonb) FROM (%s) sub',
    normalized
  )
  INTO result;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.analytics_readonly_sql(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_readonly_sql(text) TO service_role;
