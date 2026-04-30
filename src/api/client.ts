/**
 * Configures the generated hey-api Fetch client.
 *
 * The client uses a relative baseUrl so all requests go through the Vite dev
 * proxy (development) or the nginx proxy block (production). In both cases the
 * reverse proxy is responsible for adding the Mealie API token as an
 * Authorization header — the token is never present in the JS bundle.
 */

import { client } from "./generated/client.gen"

// Use the current origin so requests go through whichever proxy is in front.
// The proxy (nginx in prod, Vite server in dev) forwards /api/* to Mealie and
// injects the Authorization: Bearer header server-side.
client.setConfig({ baseUrl: "" })

export { client }
