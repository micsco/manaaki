/**
 * Configures the generated hey-api Fetch client.
 *
 * The base URL is read from the VITE_MEALIE_BASE_URL environment variable at
 * build time. During development, set this in a local .env file:
 *
 *   VITE_MEALIE_BASE_URL=http://localhost:9000
 *
 * The auth interceptor attaches the in-memory bearer token to every outgoing
 * request. Token management lives in src/api/auth.ts.
 */
import { client } from './generated/client.gen'
import { getToken } from './auth'

const baseUrl = import.meta.env.VITE_MEALIE_BASE_URL ?? 'http://localhost:9000'

client.setConfig({ baseUrl })

client.interceptors.request.use((request) => {
  const token = getToken()
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
  }
  return request
})

export { client }
