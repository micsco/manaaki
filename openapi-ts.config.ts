import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'https://demo.mealie.io/openapi.json',
  output: {
    path: 'src/api/generated',
  },
  plugins: ['@hey-api/client-fetch'],
})
