import { lazy, type ComponentProps } from "react"

import { DeferredDialog } from "./DeferredDialog"

const MealPlanDialog = lazy(() =>
  import("./MealPlanDialog").then(module => ({ default: module.MealPlanDialog }))
)
const BuildShoppingListDialog = lazy(() =>
  import("./BuildShoppingListDialog").then(module => ({ default: module.BuildShoppingListDialog }))
)
const ImportRecipeModal = lazy(() =>
  import("./ImportRecipeModal").then(module => ({ default: module.ImportRecipeModal }))
)
const AboutModal = lazy(() =>
  import("./AboutModal").then(module => ({ default: module.AboutModal }))
)

export function LazyMealPlanDialog(props: ComponentProps<typeof MealPlanDialog>) {
  return (
    <DeferredDialog onClose={props.onClose}>
      <MealPlanDialog {...props} />
    </DeferredDialog>
  )
}

export function LazyBuildShoppingListDialog(props: ComponentProps<typeof BuildShoppingListDialog>) {
  if (!props.open) return null
  return (
    <DeferredDialog onClose={props.onClose}>
      <BuildShoppingListDialog {...props} />
    </DeferredDialog>
  )
}

export function LazyImportRecipeModal(props: ComponentProps<typeof ImportRecipeModal>) {
  if (!props.open) return null
  return (
    <DeferredDialog onClose={() => props.onOpenChange(false)}>
      <ImportRecipeModal {...props} />
    </DeferredDialog>
  )
}

export function LazyAboutModal(props: ComponentProps<typeof AboutModal>) {
  if (!props.open) return null
  return (
    <DeferredDialog onClose={() => props.onOpenChange(false)}>
      <AboutModal {...props} />
    </DeferredDialog>
  )
}
