import type { CookingMethod } from "../../src/utils/recipeVersions"

export type EvalCase = {
  slug: string
  target: CookingMethod
  why: string
  method?: CookingMethod
  referenceInSteps?: RegExp
  referenceSlug?: string
}

export const EVAL_CASES: EvalCase[] = [
  {
    slug: "honey-and-mustard-chicken-traybake-recipe",
    target: "airFryer",
    why: "Traybake with liquid and chicken; needs both zones",
  },
  {
    slug: "sweet-chilli-fish-chips-traybake",
    target: "airFryer",
    why: "Fish and chips with different timings; fish doneness",
  },
  {
    slug: "chocolate-baked-oat-cups",
    target: "airFryer",
    why: "Baking, which converts less predictably",
  },
  {
    slug: "authentic-chicken-paprikash-paprikas-csirke",
    target: "slowCooker",
    why: "Hob stew; sear in the pot, reduce liquid",
  },
  {
    slug: "one-pot-lamb-and-orzo",
    target: "slowCooker",
    why: "Pasta added late, which slow cookers handle badly",
  },
  {
    slug: "macaroni-cheese",
    target: "slowCooker",
    why: "Poor fit for a slow cooker; should report low confidence or assumptions",
  },
  {
    slug: "air-fryer-chicken-leg-quarters-recipe",
    target: "oven",
    why: "Air fryer back to a generic oven",
  },
  {
    slug: "slow-cooker-lamb-tagine",
    target: "oven",
    why: "Slow cooker back to an oven casserole",
  },
  {
    slug: "harissa-chicken-traybake",
    target: "airFryer",
    why: "Simple chicken traybake; a good fit",
  },
  {
    slug: "lemon-herb-chicken-traybake",
    target: "airFryer",
    why: "Potatoes and chicken with different timings",
  },
  {
    slug: "stuffed-peppers",
    target: "airFryer",
    why: "Hob filling then bake; US units in the original",
  },
  {
    slug: "baked-cod-with-lemon-herb-quinoa-and-steamed-broccoli",
    target: "airFryer",
    why: "Fish plus hob sides that stay on the hob",
  },
  {
    slug: "keto-pork-chops",
    target: "airFryer",
    why: "Pan-fried chops with a pan sauce",
  },
  {
    slug: "swedish-meatballs-homemade-ikea-meatballs",
    target: "airFryer",
    why: "Meatballs that are usually fried, with a gravy",
  },
  {
    slug: "chicken-and-chickpea-tray-bake",
    target: "airFryer",
    why: "Traybake with chickpeas that should crisp",
  },
  {
    slug: "cottage-pie",
    target: "slowCooker",
    why: "Mince filling slow-cooked, topping finished in the oven",
  },
  {
    slug: "spicy-creamy-weeknight-bolognese",
    target: "slowCooker",
    why: "Quick hob ragu that suits a long cook",
  },
  {
    slug: "slow-cooker-pork-shoulder",
    target: "oven",
    why: "Slow cooker pulled pork back to a low oven",
  },
  {
    slug: "air-fryer-chicken-fattoush-salad-recipe",
    target: "oven",
    method: "airFryer",
    referenceInSteps: /\s*Alternatively, bake in the oven[^.]*\./g,
    why: "The author's own oven alternative is taken out of the steps and given to the judge",
  },
  {
    slug: "bbq-chicken-twice-baked-potatoes",
    target: "airFryer",
    referenceSlug: "bbq-chicken-twice-baked-potatoes-air-fryer",
    why: "The household's own air fryer version is given to the judge",
  },
]
