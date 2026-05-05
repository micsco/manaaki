import { describe, expect, it } from "vitest"
import type { Nutrition, RecipeSettings } from "../api/generated/types.gen"
import { render, screen } from "../test/render"
import { NutritionPanel } from "./NutritionPanel"

const fullNutrition: Nutrition = {
  calories: "581",
  carbohydrateContent: "75.2",
  cholesterolContent: null,
  fatContent: "14.4",
  fiberContent: "7.3",
  proteinContent: "40.3",
  saturatedFatContent: "8.2",
  sodiumContent: "2507.1",
  sugarContent: "6.4",
  transFatContent: "0",
  unsaturatedFatContent: "0.0",
}

const showSettings: RecipeSettings = { showNutrition: true }
const hideSettings: RecipeSettings = { showNutrition: false }

describe("NutritionPanel", () => {
  it("renders nothing when showNutrition is false", () => {
    const { container } = render(
      <NutritionPanel nutrition={fullNutrition} settings={hideSettings} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when nutrition is null", () => {
    const { container } = render(<NutritionPanel nutrition={null} settings={showSettings} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when settings is null", () => {
    const { container } = render(<NutritionPanel nutrition={fullNutrition} settings={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when both are undefined", () => {
    const { container } = render(<NutritionPanel />)
    expect(container.firstChild).toBeNull()
  })

  it("renders the 'Per serving' label", () => {
    render(<NutritionPanel nutrition={fullNutrition} settings={showSettings} />)
    expect(screen.getByText(/per serving/i)).toBeInTheDocument()
  })

  it("renders calories from the nutrition data", () => {
    render(<NutritionPanel nutrition={fullNutrition} settings={showSettings} />)
    expect(screen.getByText("581")).toBeInTheDocument()
  })

  it("renders protein, carbs and fat", () => {
    render(<NutritionPanel nutrition={fullNutrition} settings={showSettings} />)
    expect(screen.getByText("Protein")).toBeInTheDocument()
    expect(screen.getByText("Carbs")).toBeInTheDocument()
    expect(screen.getByText("Fat")).toBeInTheDocument()
  })

  it("renders secondary stats (fibre, sugar, sodium, sat. fat)", () => {
    render(<NutritionPanel nutrition={fullNutrition} settings={showSettings} />)
    expect(screen.getByText(/fibre/i)).toBeInTheDocument()
    expect(screen.getByText(/sugar/i)).toBeInTheDocument()
    expect(screen.getByText(/sodium/i)).toBeInTheDocument()
    expect(screen.getByText(/sat\. fat/i)).toBeInTheDocument()
  })

  it("omits stats that are null", () => {
    const sparseNutrition: Nutrition = {
      calories: "300",
      proteinContent: "20",
      carbohydrateContent: null,
      fatContent: null,
    }
    render(<NutritionPanel nutrition={sparseNutrition} settings={showSettings} />)
    expect(screen.queryByText("Carbs")).not.toBeInTheDocument()
    expect(screen.queryByText("Fat")).not.toBeInTheDocument()
  })

  it("omits stats that are zero", () => {
    const zeroNutrition: Nutrition = {
      calories: "537",
      proteinContent: "62.1",
      carbohydrateContent: "0.5",
      fatContent: "30.2",
      transFatContent: "0",
      unsaturatedFatContent: "0.0",
    }
    render(<NutritionPanel nutrition={zeroNutrition} settings={showSettings} />)
    expect(screen.queryByText(/trans fat/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/unsaturated/i)).not.toBeInTheDocument()
  })

  it("has an accessible section label", () => {
    render(<NutritionPanel nutrition={fullNutrition} settings={showSettings} />)
    expect(screen.getByRole("region", { name: /nutrition information/i })).toBeInTheDocument()
  })

  it("renders nothing when all nutrition values are falsy", () => {
    const emptyNutrition: Nutrition = {
      calories: null,
      proteinContent: null,
      carbohydrateContent: null,
      fatContent: null,
    }
    const { container } = render(
      <NutritionPanel nutrition={emptyNutrition} settings={showSettings} />
    )
    expect(container.firstChild).toBeNull()
  })
})
