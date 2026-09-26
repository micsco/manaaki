import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  input: "./schema/mealie-v3.28.0.openapi.json",
  output: {
    path: "src/api/generated",
  },
  plugins: [
    {
      name: "@hey-api/client-fetch",
      baseUrl: false,
    },
  ],
})
