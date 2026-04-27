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
# Edit VITE_MEALIE_BASE_URL to point at your Mealie instance

# 3. Start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`. Vite automatically proxies all `/api` requests to your Mealie instance, so no CORS configuration is needed.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_MEALIE_BASE_URL` | `http://localhost:9000` | URL of the Mealie backend. Used by the Vite dev server proxy. |

> In production this variable only affects the dev server proxy. API requests from the built app use relative `/api` paths, which your reverse proxy routes to Mealie.

---

## Authentication

What's Cookin' supports two login methods:

- **Username / password** — always available
- **OAuth / OIDC** (e.g. Google, Authentik, Keycloak) — when enabled on your Mealie instance

Authentication is handled entirely by Mealie's backend. This app never talks to the IdP directly.

### How the OAuth flow works

```
User clicks "Sign in with OAuth"
  → browser navigates to /api/auth/oauth
  → proxied to Mealie, which redirects to the IdP (Google, etc.)
  → user authenticates with IdP
  → IdP redirects back to /login?code=...&state=...  (on this app)
  → this app POSTs the code to /api/auth/oauth/callback
  → Mealie exchanges it, validates the user, returns a bearer token
  → app stores the token and navigates home
```

Because all `/api` paths are proxied, Mealie sees requests arriving from `localhost:3000` (dev) or your domain (production) and constructs its OAuth redirect URI accordingly — pointing straight back at this app. No extra configuration is needed for the redirect to land in the right place.

### Development setup

1. Set `VITE_MEALIE_BASE_URL` in your `.env` to your Mealie instance URL
2. Run `pnpm dev`
3. Register `http://localhost:3000/login` as an allowed redirect URI in your IdP (e.g. Google Cloud Console → OAuth 2.0 client → Authorised redirect URIs)

That's it. The Vite proxy handles the rest.

### Production setup

The built app uses relative `/api` paths throughout, so you just need a reverse proxy that routes `/api` to Mealie and everything else to the static files.

**nginx**

```nginx
server {
    server_name recipes.example.com;

    # Mealie API
    location /api/ {
        proxy_pass http://mealie:9000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # What's Cookin' static files
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

**Cloudflare Pages / Netlify**

Add a redirect rule to proxy `/api/*` to your Mealie instance:

```
# Netlify _redirects
/api/*  https://mealie.example.com/api/:splat  200

# Catch-all for SPA
/*  /_shell.html  200
```

> **Note for Cloudflare Pages**: the `/api` proxy requires a Cloudflare Worker or a Pages Function. Alternatively, host Mealie on the same domain via a reverse proxy and point Cloudflare's DNS at it.

### IdP redirect URI

In all cases, register your app's `/login` URL with your IdP:

| IdP | Where | Value |
|---|---|---|
| **Google** | Cloud Console → OAuth 2.0 client → Authorised redirect URIs | `https://recipes.example.com/login` |
| **Authentik** | Application → Redirect URIs | `https://recipes.example.com/login` |
| **Keycloak** | Client → Valid redirect URIs | `https://recipes.example.com/login` and `https://recipes.example.com/login?direct=1` |
| **Authelia** | Client → Redirect URIs | `https://recipes.example.com/login` |

For local dev, also register `http://localhost:3000/login`.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server at `http://localhost:3000` with Mealie API proxy |
| `pnpm build` | Production build — outputs static files including `/_shell.html` |
| `pnpm preview` | Preview the production build locally |
| `pnpm generate` | Regenerate the Mealie API client from the live OpenAPI spec |

---

## Project structure

```
src/
├── api/
│   ├── auth.ts           # Login, logout, OAuth redirect & callback, token store
│   ├── client.ts         # Configures the generated API client (baseUrl, auth interceptor)
│   └── generated/        # Auto-generated from Mealie's OpenAPI spec — do not edit
├── routes/
│   ├── __root.tsx        # Root layout
│   ├── index.tsx         # Home page
│   └── login.tsx         # Login page (handles both password and OAuth callback)
```

See [`PLAN.md`](./PLAN.md) for the full architecture notes and roadmap.
