# Skill: nginx API proxy for Mealie

## When to load this skill

Load this skill when:
- Adding a new Mealie API endpoint to the allowlist in nginx
- Changing how the API token or Mealie URL is configured
- Troubleshooting API connectivity in production or development
- Changing the Docker network or internal hostname for Mealie
- Understanding why the app no longer uses `VITE_MEALIE_API_TOKEN`

---

## Architecture overview

What's Cookin' is a pure SPA (no Node server). To avoid exposing the Mealie API
token in the JavaScript bundle, **nginx acts as a backend proxy** that:

1. Receives `/api/*` requests from the browser
2. Injects `Authorization: Bearer <token>` server-side
3. Forwards only allowlisted GET requests to the Mealie container
4. Blocks all non-GET methods (405) and non-allowlisted paths (403)

```
Browser
  │  GET /api/recipes   (no Authorization header)
  ▼
nginx (What's Cookin' container, port 80)
  │  GET /api/recipes
  │  Authorization: Bearer <token>   ← added by nginx, from MEALIE_API_TOKEN env var
  ▼
Mealie container (internal Docker network, port 9000)
  │  response
  ▼
nginx → Browser
```

The token **never** appears in the JS bundle or browser DevTools.

---

## Configuration files

| File | Purpose |
|------|---------|
| `nginx.conf.template` | nginx server block; processed at container start by `envsubst` |
| `mealie-proxy-headers.conf.template` | Shared proxy headers (Authorization, forwarding headers) |
| `Dockerfile` | Stage 2 runs `envsubst` then starts nginx |
| `vite.config.ts` | Dev server proxy — mirrors nginx behaviour for local development |
| `.env.example` | Documents the required environment variables |

---

## Environment variables

These are **runtime** variables (set in Dokploy → Environment, not build args):

| Variable | Description | Example |
|----------|-------------|---------|
| `MEALIE_API_TOKEN` | Long-lived Mealie API token | `eyJhbGc...` |
| `MEALIE_INTERNAL_URL` | Internal Docker URL for Mealie | `http://scottfamilynz-mealie-cvtizz-mealie-1:9000` |

> **Never** set `VITE_MEALIE_API_TOKEN` or `VITE_MEALIE_BASE_URL` — those
> variables were removed and would leak the token into the JS bundle.

---

## Allowed API endpoints

Only these paths are proxied. Everything else returns **403 Forbidden**.

| Pattern | Description |
|---------|-------------|
| `GET /api/recipes` | Recipe list |
| `GET /api/recipes/<slug>/...` | Recipe detail, assets |
| `GET /api/users/self` | Current-user probe (startup check) |
| `GET /api/media/recipes/**` | Recipe images |

All non-GET methods on allowed paths return **405 Method Not Allowed**.

### Adding a new endpoint

Edit `nginx.conf.template` and add a new `location` block **before** the
catch-all `location /api/` block:

```nginx
# /api/categories (recipe categories)
location ~ ^/api/categories(/.*)?$ {
    if ($request_method != GET) {
        return 405;
    }
    proxy_pass ${MEALIE_INTERNAL_URL};
    include /etc/nginx/conf.d/mealie-proxy-headers.conf;
}
```

Then redeploy so the template is re-processed by `envsubst`.

---

## Local development

The Vite dev server mirrors the nginx proxy so local development works without
Docker:

1. Copy `.env.example` to `.env`
2. Set `MEALIE_INTERNAL_URL=http://localhost:9000` (or wherever your local
   Mealie runs)
3. Set `MEALIE_API_TOKEN=<your-token>`
4. Run `pnpm dev`

Vite's proxy forwards `/api/*` to `MEALIE_INTERNAL_URL` and injects the
`Authorization` header via the `proxyReq` hook in `vite.config.ts`.

---

## Dokploy deployment

### Network setup (required for internal routing)

Mealie runs as an isolated compose service (`scottfamilynz-mealie-cvtizz`).
To allow the What's Cookin' nginx container to reach it without going via the
public internet:

1. In Dokploy → What's Cookin' → **Advanced → Network (Swarm)**  
   Add network: `scottfamilynz-mealie-cvtizz_default`  
   (This joins the What's Cookin' container to Mealie's Docker network.)

2. Set `MEALIE_INTERNAL_URL` to the container hostname:  
   `http://scottfamilynz-mealie-cvtizz-mealie-1:9000`  
   (The hostname follows the Docker Compose convention:
   `<appName>-<service>-<replica>`)

### Environment variables in Dokploy

In Dokploy → What's Cookin' → **Environment**:

```env
MEALIE_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
MEALIE_INTERNAL_URL=http://scottfamilynz-mealie-cvtizz-mealie-1:9000
```

### Finding the correct internal hostname

If unsure of the container name, SSH into the Dokploy server and run:
```sh
docker ps --filter "name=mealie" --format "{{.Names}}"
```

---

## How `envsubst` works

`envsubst` is a simple tool that replaces `${VAR}` placeholders in text with
the value of the matching environment variable. The Dockerfile CMD runs it at
container start-up:

```dockerfile
CMD ["/bin/sh", "-c", \
  "envsubst '${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}' \
     < /etc/nginx/templates/nginx.conf.template \
     > /etc/nginx/conf.d/default.conf && \
   envsubst ... mealie-proxy-headers.conf.template > ... && \
   nginx -g 'daemon off;'"]
```

The variable list passed to `envsubst` (`'${MEALIE_INTERNAL_URL} ${MEALIE_API_TOKEN}'`)
is important — it prevents `envsubst` from clobbering nginx's own `$variable`
syntax (e.g. `$host`, `$remote_addr`).

---

## Security properties

- Token is held only in the container's environment — not in the image layers,
  not in the JS bundle, not in browser memory
- Non-GET methods are blocked at the nginx level (before the request reaches
  Mealie), preventing writes even if someone discovers the proxy endpoint
- Only the three endpoint groups the app actually uses are reachable; the rest
  of the Mealie API returns 403
- The browser sends no Authorization header — nginx strips any incoming
  `Authorization` header and replaces it with its own
