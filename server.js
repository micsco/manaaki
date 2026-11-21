import { serve } from "srvx/node"

import serverBuild from "./dist/server/server.js"

serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT) || 3000,
  fetch: request => serverBuild.fetch(request),
})
