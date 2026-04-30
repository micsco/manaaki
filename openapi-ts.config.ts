import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'https://demo.mealie.io/openapi.json',
  output: {
    path: 'src/api/generated',
  },
  plugins: [
    {
      name: '@hey-api/client-fetch',
      baseUrl: false,
    },
  ],
})
