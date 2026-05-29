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
- `NODE_ENV` - `development` or `production`

Current `.env.example` also includes:
- `PROJECTDB_URL`

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
