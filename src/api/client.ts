/**
 * Configures the generated hey-api Fetch client.
 *
 * The client uses a relative baseUrl so all requests go through the Vite dev
 * proxy (development) or the reverse proxy (production), both of which forward
 * /api/* to the Mealie backend. This means VITE_MEALIE_BASE_URL never needs to
 * be embedded in the built JS bundle.
 *
 * The auth interceptor attaches the API token to every outgoing request.
 * Token management lives in src/api/auth.ts.
 */

import { getToken } from "./auth"
import { client } from "./generated/client.gen"

// Use the current origin so requests go through whichever proxy is in front
client.setConfig({ baseUrl: "" })

client.interceptors.request.use(request => {
  const token = getToken()
  if (token) {
    request.headers.set("Authorization", `Bearer ${token}`)
  }
  return request
})

export { client }
