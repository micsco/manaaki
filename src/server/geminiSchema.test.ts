import { describe, expect, it } from "vitest"

import { toGeminiSchema } from "./geminiSchema"

describe("toGeminiSchema", () => {
  it("inlines $defs, turns null unions into nullable and drops unsupported keywords", () => {
    expect(
      toGeminiSchema({
        $defs: {
          note: {
            type: "object",
            properties: { text: { type: "string", description: "x" } },
            additionalProperties: false,
            required: ["text"],
          },
        },
        type: "object",
        additionalProperties: false,
        properties: {
          notes: { type: "array", items: { $ref: "#/$defs/note" }, maxItems: 10 },
          zone: { type: ["string", "null"] },
          quantity: { anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }] },
        },
        required: ["notes", "zone", "quantity"],
      })
    ).toEqual({
      type: "object",
      properties: {
        notes: {
          type: "array",
          items: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
          maxItems: 10,
        },
        zone: { type: "string", nullable: true },
        quantity: { type: "number", nullable: true },
      },
      required: ["notes", "zone", "quantity"],
    })
  })
})
