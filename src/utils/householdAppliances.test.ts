import { describe, expect, it } from "vitest"

import { describeAppliance, householdAppliance } from "./householdAppliances"

describe("householdAppliance", () => {
  it("knows the household's air fryer and slow cooker, but not a specific oven", () => {
    expect(householdAppliance("airFryer")?.model).toBe("AF400UK")
    expect(householdAppliance("slowCooker")?.model).toBe("MC1001UK")
    expect(householdAppliance("oven")).toBeNull()
  })

  it("describes the details and how to write for it", () => {
    const text = describeAppliance(householdAppliance("slowCooker")!)
    expect(text).toMatch(
      /^The household cooks with a Ninja Foodi 8-in-1 PossibleCooker \(MC1001UK\):/
    )
    expect(text).toContain("- 8 L cooking pot")
    expect(text).toContain("Write the method for this appliance:")
    expect(text).toContain("- Brown meat and soften onions in the pot with Sear/Sauté")
  })
})
