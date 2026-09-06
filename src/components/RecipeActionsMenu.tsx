import { Popover } from "@base-ui/react/popover"
import { mdiDotsHorizontal } from "@mdi/js"

import type { RecipeOutput } from "../api/generated/types.gen"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { AddToShoppingListButton } from "./AddToShoppingListButton"
import { Icon } from "./Icon"
import { RecipeRepair } from "./RecipeRepair"

export function RecipeActionsMenu({ recipe }: { recipe: RecipeOutput }) {
  const current = useCurrentUser()
  if (!current || current.isAnonymous) return null
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Recipe actions"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/40 p-2.5 text-white backdrop-blur-xs transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-orange-400"
      >
        <Icon path={mdiDotsHorizontal} size={0.8} aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8}>
          <Popover.Popup className="z-40 rounded-2xl border border-gray-800 bg-gray-900 p-2 shadow-2xl">
            <Popover.Title className="sr-only">Recipe actions</Popover.Title>
            <AddToShoppingListButton recipe={recipe} />
            <RecipeRepair recipe={recipe} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
