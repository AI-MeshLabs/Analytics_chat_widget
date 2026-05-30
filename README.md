# Analytics Chat Widget

Standalone Next.js app for an embeddable analytics chat widget (OnePoint Call Analytics).

## Setup Commands

```bash
npm install
cp .env.example .env
npm run dev
```

App routes:
- Main app: `http://localhost:3000`
- Demo embed host page: `http://localhost:3000/demo-embed`

## Environment Variables

Required/expected values:

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key used server-side for read queries
- `SUPABASE_DB_SCHEMA` - Postgres schema for analytics tables (default `onepoint`)
- `NEXT_PUBLIC_WIDGET_USE_BACKEND` - `true` = widget → `/api/analytics-chat/query`; `false` = widget → n8n webhook (default)
- `NEXT_PUBLIC_N8N_WEBHOOK_URL` - n8n webhook URL when `NEXT_PUBLIC_WIDGET_USE_BACKEND=false`
- `NODE_ENV` - `development` or `production`

### Widget → n8n (default)

With `NEXT_PUBLIC_WIDGET_USE_BACKEND=false` and `NEXT_PUBLIC_N8N_WEBHOOK_URL` set, the chat widget POSTs `{ "question": "..." }` to your n8n webhook. n8n should respond with `{ "answer": "..." }` (optional `data`).

Set `NEXT_PUBLIC_WIDGET_USE_BACKEND=true` to bypass n8n and use the local intent-based API instead.

### n8n read-only SQL

1. Run `scripts/analytics_readonly_sql.sql` once in the Supabase SQL editor.
2. n8n HTTP Request node:

```http
POST {apiBase}/api/analytics-chat/sql
Content-Type: application/json

{ "sql": "SELECT COUNT(*) AS total FROM onepoint.calls WHERE call_date::date = CURRENT_DATE" }
```

Allowed columns on `onepoint.calls`: **`call_date`**, **`duration_secs`**, **`status`** only. `SELECT *` and other columns (e.g. `name`, `summary`, `email`) are rejected. Aggregates like `COUNT(*)`, `AVG(duration_secs)` are allowed.

Response: `{ "success": true, "rows": [...], "rowCount": N }` or `{ "success": false, "error": "..." }`.

The chat widget still uses `POST /api/analytics-chat/query` with `{ "question": "..." }` only.

### n8n OpenAI prompts

Use two OpenAI nodes: **generate SQL**, then **final answer**. Respond to Webhook must return `{ "answer": "..." }` for the chat widget.

#### 1) Generate SQL — System message

```text
You write PostgreSQL SELECT queries for OnePoint call analytics.

OUTPUT: One SQL line only. No markdown, no explanation, no semicolon.

Table: onepoint.calls only.
Columns you may use: call_date, duration_secs, status.
Never SELECT *. Never use id, name, email, summary, created_at, or any other column.

Date rules (use call_date, not created_at):
- today → call_date::date = CURRENT_DATE
- yesterday → call_date::date = CURRENT_DATE - INTERVAL '1 day'
- this week → call_date >= DATE_TRUNC('week', CURRENT_DATE)
- this month → call_date >= DATE_TRUNC('month', CURRENT_DATE)

Intent → SQL patterns:
- "how many calls" / "total calls" / "calls made" → COUNT(*)::int AS total_calls
- "average duration" → COALESCE(AVG(duration_secs), 0)::int AS average_duration_seconds
- "unsuccessful" / "failed" / "missed" → COUNT(*)::int AS unsuccessful_calls AND LOWER(status::text) IN ('failed', 'missed', 'incomplete', 'dropped')
- "by status" → SELECT status, COUNT(*)::int AS total_count ... GROUP BY status
- "by day" → SELECT call_date::date AS call_date, COUNT(*)::int AS total_calls ... GROUP BY call_date::date ORDER BY call_date DESC LIMIT 31

Examples:
Q: How many calls were made today?
A: SELECT COUNT(*)::int AS total_calls FROM onepoint.calls WHERE call_date::date = CURRENT_DATE

Q: Average call duration today?
A: SELECT COALESCE(AVG(duration_secs), 0)::int AS average_duration_seconds FROM onepoint.calls WHERE call_date::date = CURRENT_DATE
```

**User message:** `{{ $json.question }}` (or your webhook field name)

#### 2) Final answer — System message

```text
You are Sally, a concise analytics assistant for a call dashboard.

You receive:
1) The user's original question
2) JSON query results (one row for aggregates, or a short list)

Rules:
- Answer in 1–2 short sentences, friendly and clear.
- Use ONLY numbers from the query results. Never invent data.
- For total_calls: say "There were **N calls today**" (or yesterday / this week / this month — match the question).
- Use singular "1 call" when N is 1.
- For average_duration_seconds: convert to minutes and seconds (e.g. "2 minutes 15 seconds").
- For unsuccessful_calls: mention missed or incomplete if relevant.
- You may use **bold** around the key number or phrase.
- Do not mention SQL, databases, or JSON.

Examples:
Question: How many calls were made today?
Results: [{"total_calls":94}]
Answer: There were **94 calls today** across all tracked lines.

Question: How many calls today?
Results: [{"total_calls":1}]
Answer: There was **1 call today** across all tracked lines.
```

**User message:**

```text
Question: {{ $('Webhook').first().json.question }}

Query results:
{{ JSON.stringify($json.rows ?? []) }}

Write the dashboard answer.
```

Adjust `Webhook` to your webhook node name. Use `$json.rows` from the HTTP Request node output, not the full `$json` object.

#### 3) Respond to Webhook

Return JSON the widget expects:

```json
{
  "answer": "There were **94 calls today** across all tracked lines."
}
```

## Embed Instructions

Use this snippet inside another app:

```html
<script>
  window.AnalyticsWidgetConfig = {
    apiBase: "https://domain.com",
    token: ""
  };
</script>
<script src="https://domain.com/analytics-widget.js"></script>
```

Notes:
- `analytics-widget.js` is served from `public/analytics-widget.js`
- Widget API calls go to `${apiBase}/api/analytics-chat/query`
- The script uses Shadow DOM to avoid affecting host app CSS

## Deployment Instructions

### Docker (single container)

Build and run:

```bash
docker build -t analytics-chat-widget .
docker run --rm -p 4003:4003 \
  -e NODE_ENV=production \
  -e SUPABASE_URL="https://your-project-id.supabase.co" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  analytics-chat-widget
```

The app is exposed on port `4003`.

### Docker Compose

1. Set environment values in `.env`
2. Run:

```bash
docker compose up --build -d
```

Service config is in `docker-compose.yml` and maps `4003:4003`.

### VPS: use production, not `next dev`

On a server, run a **production** build and `next start` (or Docker). **Do not** use `npm run dev` in production: it enables **webpack HMR** over WebSockets (`/_next/webpack-hmr`), which often **fails** when you use Nginx, a non-proxying port forward, or HTTP without WebSocket upgrade — you will see red console errors and unstable behavior. Example:

```bash
npm ci
npm run build
NODE_ENV=production npm run start -- -p 3002
```

Put `.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` next to the app (or export them in the shell). Use [`upgrade` headers](https://nginx.org/en/docs/http/websocket.html) in Nginx only if you intentionally run **development** mode behind a proxy.
