import { client } from "./generated/client.gen"
import { retryingFetch } from "./retryingFetch"

client.setConfig({ baseUrl: "", fetch: retryingFetch })

export { client }
