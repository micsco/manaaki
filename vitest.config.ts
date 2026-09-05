import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const nodeTests = [
  "src/server/**/*.test.ts",
  "src/routes/-api*.test.ts",
  "src/api/**/*.test.ts",
  "src/utils/!(audio).test.ts",
  "src/routes/-manifest.test.ts",
]

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "~": "/src",
    },
  },
  test: {
    globals: true,
    fsModuleCache: true,
    projects: [
      {
        test: { name: "node", environment: "node", include: nodeTests },
      },
      {
        test: {
          name: "dom",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          exclude: nodeTests,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/api/generated/**", "src/routeTree.gen.ts", "src/test/**"],
    },
  },
})
