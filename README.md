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
# Edit .env and set VITE_MEALIE_BASE_URL to your Mealie instance URL

# 3. Start the dev server
pnpm dev
```

The app runs at `http://localhost:3000`.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_MEALIE_BASE_URL` | `http://localhost:9000` | Base URL of the Mealie instance to connect to |

Variables are baked in at Vite build time. For production deployments set them in your hosting platform's config rather than committing a `.env` file.

---

## Authentication

What's Cookin' supports two login methods depending on how your Mealie instance is configured:

- **Username / password** — always available
- **OAuth / OIDC** (e.g. Google, Authentik, Keycloak) — when enabled on the Mealie server

Authentication is handled entirely by Mealie's backend. This app never talks to the IdP directly — it just initiates the redirect and forwards the resulting callback params to Mealie.

### Connecting to a Mealie instance using OAuth

This requires a small amount of one-time setup so that Mealie knows to redirect the browser back to this app after a successful OAuth login.

#### How the OAuth flow works

1. User clicks "Sign in with OAuth" → browser is sent to `{MEALIE_URL}/api/auth/oauth`
2. Mealie redirects to the IdP (e.g. Google)
3. User authenticates with the IdP
4. IdP redirects back to Mealie with `?code=...&state=...`
5. Mealie redirects the browser to **this app's `/login` page** with those params
6. This app forwards them to `{MEALIE_URL}/api/auth/oauth/callback`
7. Mealie exchanges the code, validates the user, and returns a bearer token
8. The app stores the token in memory and proceeds

Step 5 is the key: **Mealie must be configured to redirect back to this app's URL**, not its own frontend.

#### Development setup

Mealie automatically uses `http://localhost:3000/login` as the redirect target when running in development mode (`PRODUCTION=false`). No extra config is needed — just run this app on port 3000 alongside Mealie.

#### Production setup

In production, Mealie constructs the redirect URI from its own base URL. To override this so it points at this app instead, you have two options:

**Option A — Reverse proxy (recommended)**

Serve this app and Mealie under the same domain, with the app at `/` and Mealie's API at `/api`:

```
https://recipes.example.com/          → this app (What's Cookin')
https://recipes.example.com/api/      → Mealie backend
https://recipes.example.com/login     → this app's /login route
```

With this setup Mealie's redirect URI (`https://recipes.example.com/login`) naturally lands on this app. Example nginx config:

```nginx
server {
    server_name recipes.example.com;

    # Mealie API and auth
    location /api/ {
        proxy_pass http://mealie:9000/api/;
    }

    # This app (all other paths)
    location / {
        proxy_pass http://whats-cookin:3000;
        # For SPA: fall back to index on 404
        try_files $uri /_shell.html;
    }
}
```

**Option B — Set `BASE_URL` on Mealie**

Set the `BASE_URL` environment variable on your Mealie instance to this app's URL:

```env
BASE_URL=https://recipes.example.com
```

Mealie will then construct redirect URIs relative to that base. Make sure your IdP has `https://recipes.example.com/login` registered as an allowed redirect URI.

#### IdP redirect URI configuration

Whichever option you choose, you must register the redirect URI with your IdP:

| Where | What to add |
|---|---|
| **Google Cloud Console** → OAuth 2.0 client → Authorised redirect URIs | `https://recipes.example.com/login` |
| **Authentik** → Application → Redirect URIs | `https://recipes.example.com/login` |
| **Keycloak** → Client → Valid redirect URIs | `https://recipes.example.com/login` and `https://recipes.example.com/login?direct=1` |
| **Authelia** → Client → Redirect URIs | `https://recipes.example.com/login` |

> For local dev the URI to register is `http://localhost:3000/login`. Mealie's dev mode already uses this, but some IdPs (e.g. Google) also validate the URI on the initial redirect, so it must be registered there too.

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server at `http://localhost:3000` |
| `pnpm build` | Production build (outputs `/_shell.html` SPA shell) |
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
