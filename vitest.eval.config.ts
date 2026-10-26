import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "eval",
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    testTimeout: 120_000,
  },
})
