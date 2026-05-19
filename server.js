import { serve } from "srvx/node";
import serverBuild from "./dist/server/server.js";

serve({
  port: Number(process.env.PORT) || 3000,
  fetch: serverBuild.fetch,
});
