# What's Cookin'

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
# Edit .env — set VITE_MEALIE_BASE_URL and VITE_MEALIE_API_TOKEN

# 3. Start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`. Vite automatically proxies all `/api` requests to your Mealie instance, so no CORS configuration is needed.

---

## Environment variables

| Variable                | Required | Description                                                     |
| ----------------------- | -------- | --------------------------------------------------------------- |
| `VITE_MEALIE_BASE_URL`  | Yes      | URL of your Mealie instance. Used by the Vite dev server proxy. |
| `VITE_MEALIE_API_TOKEN` | Yes      | Long-lived API token from your Mealie profile.                  |

Both variables are baked into the JS bundle at build time by Vite. Do not commit your `.env` file.

### Generating an API token

1. Open your Mealie instance and sign in
2. Click your avatar → **Profile**
3. Scroll to **API Tokens** → **Generate**
4. Copy the token into `VITE_MEALIE_API_TOKEN` in your `.env`

---

## How requests work

All API calls use relative `/api/...` paths. In development these are proxied by Vite to `VITE_MEALIE_BASE_URL`. In production they are handled by your reverse proxy. The API token is attached as a `Bearer` header on every request.

```
Browser → /api/recipes
  [dev]  → Vite proxy → http://your-mealie:9000/api/recipes
  [prod] → nginx/Caddy → http://mealie:9000/api/recipes
```

---

## Production deployment

Build the app:

```sh
pnpm build   # outputs to dist/
```

The build output is a static SPA — just a `/_shell.html` and assets. You need a reverse proxy that:

1. Forwards `/api/*` to your Mealie instance
2. Falls back to `/_shell.html` for everything else

**nginx**

```nginx
server {
    server_name recipes.example.com;

    location /api/ {
        proxy_pass http://mealie:9000/api/;
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

**Netlify**

```
# public/_redirects
/api/*  https://mealie.example.com/api/:splat  200
/*      /_shell.html                            200
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
