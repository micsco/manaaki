# Manaaki

*Manaaki* (mah-NAH-kee) — in te reo Māori, the act of caring for someone through hospitality. The kind of love that gets expressed by feeding people well. As a Kiwi cooking for the people I love from the other side of the world, it felt like the right name for the kitchen I keep on my phone. It's also a gentle echo of Mealie, the backend it's built on.

An alternative frontend for [Mealie](https://mealie.io), the self-hosted recipe manager.

Built with [TanStack Start](https://tanstack.com/start) in SPA mode — pure client-side, deployable to any CDN.

---

## Requirements

- Node.js 22+
- pnpm 10+
- A running Mealie instance (v2+)

---

## Getting started

```sh
# 1. Install dependencies
pnpm install

# 2. Configure your environment
cp .env.example .env
# Edit .env — set MEALIE_INTERNAL_URL and MEALIE_API_TOKEN

# 3. Start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`. Vite automatically proxies all `/api` requests to your Mealie instance, so no CORS configuration is needed.

---

## Environment variables

| Variable               | Required | Description                                                     |
| ---------------------- | -------- | --------------------------------------------------------------- |
| `MEALIE_API_TOKEN`     | Yes      | Long-lived Mealie API token — stays server-side only            |
| `MEALIE_INTERNAL_URL`  | Yes      | Docker-internal URL for Mealie (e.g. `http://mealie:9000`)      |

The token is never included in the JS bundle. In development the Vite proxy injects it; in production nginx handles it. See [API proxy architecture](#api-proxy-architecture) below.

### Generating an API token

1. Open your Mealie instance and sign in
2. Click your avatar → **Profile**
3. Scroll to **API Tokens** → **Generate**
4. Copy the token into `MEALIE_API_TOKEN` in your `.env`

---

## How requests work

All API calls use relative `/api/...` paths. In development these are proxied by Vite to `MEALIE_INTERNAL_URL` with the token injected server-side. In production nginx handles both routing and auth.

```
Browser → /api/recipes
  [dev]  → Vite proxy → http://your-mealie:9000/api/recipes  (token injected)
  [prod] → nginx       → http://mealie:9000/api/recipes       (token injected)
```

---

## API proxy architecture

The Mealie API token lives **only on the server** — it is never in the JS bundle. nginx (inside the container) acts as a reverse proxy: it adds the `Authorization: Bearer` header to `/api/*` requests and only exposes a GET-only allowlist of Mealie endpoints.

---

## Production deployment

Build the app:

```sh
pnpm build   # outputs to dist/
```

The build output is a static SPA — just a `/_shell.html` and assets. You need a reverse proxy that:

1. Forwards `/api/*` to your Mealie instance (with auth header)
2. Falls back to `/_shell.html` for everything else

**nginx**

```nginx
server {
    server_name recipes.example.com;

    location /api/ {
        proxy_pass http://mealie:9000/api/;
        proxy_set_header Authorization "Bearer $MEALIE_API_TOKEN";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        root /path/to/dist;
        try_files $uri /_shell.html;
    }
}
```

**Caddy**

```caddy
recipes.example.com {
    handle /api/* {
        reverse_proxy mealie:9000
    }
    handle {
        root * /path/to/dist
        try_files {path} /_shell.html
        file_server
    }
}
```

---

## Scripts

| Command         | Description                                                       |
| --------------- | ----------------------------------------------------------------- |
| `pnpm dev`      | Start dev server at `http://localhost:3000` with Mealie API proxy |
| `pnpm build`    | Production build — outputs static files to `dist/`                |
| `pnpm preview`  | Preview the production build locally                              |
| `pnpm generate` | Regenerate the Mealie API client from the live OpenAPI spec       |

---

## Project structure

```
src/
├── api/
│   ├── auth.ts           # Token store and getCurrentUser helper
│   ├── client.ts         # Configures the generated API client (auth interceptor)
│   └── generated/        # Auto-generated from Mealie's OpenAPI spec — do not edit
├── routes/
│   ├── __root.tsx        # Root layout
│   ├── index.tsx         # Home page
│   └── login.tsx         # Shown when no API token is configured
```

See [`PLAN.md`](./PLAN.md) for the full architecture notes and roadmap.
