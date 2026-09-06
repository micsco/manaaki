import { Dialog } from "@base-ui/react/dialog"
import { mdiClose, mdiShuffle } from "@mdi/js"

import { useMotionPermissionContext } from "../contexts/MotionPermissionContext"
import ManaakiLogo from "../manaaki.svg?react"
import { Icon } from "./Icon"
import { InstallApp } from "./InstallApp"
import { Button } from "./ui"

interface AboutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const { state: permissionState, request: requestPermission } = useMotionPermissionContext()

  async function handleEnableShake() {
    await requestPermission()
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs" />
        <Dialog.Popup
          className={[
            "mobile-dialog fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-gray-800 bg-gray-900 shadow-xl",
            "focus:outline-hidden",
          ].join(" ")}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <Dialog.Title className="text-lg font-semibold text-gray-100">
              About Manaaki
            </Dialog.Title>
            <Dialog.Close
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200 focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
              aria-label="Close"
            >
              <Icon path={mdiClose} size={0.7} aria-hidden={true} />
            </Dialog.Close>
          </div>

          <div className="space-y-5 px-5 pb-6">
            <div className="flex items-center gap-3">
              <ManaakiLogo className="size-10 shrink-0" />
              <Dialog.Description className="text-sm leading-relaxed text-gray-400">
                Manaaki is a beautiful frontend for <span className="text-gray-300">Mealie</span>,
                the self-hosted recipe manager. Browse, filter, and cook through your family's
                recipe collection.
              </Dialog.Description>
            </div>

            <InstallApp />

            {permissionState === "prompt" && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600/20 text-orange-400">
                    <Icon path={mdiShuffle} size={0.65} aria-hidden={true} />
                  </div>
                  <p className="text-sm font-medium text-gray-200">Shake for a random recipe</p>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-gray-400">
                  Give your phone a shake and Manaaki will pick a random recipe for you. Tap below
                  to enable motion access.
                </p>
                <Button variant="primary" size="md" onClick={handleEnableShake} className="w-full">
                  Enable shake
                </Button>
              </div>
            )}

            {permissionState === "denied" && (
              <p className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 text-sm text-gray-500">
                Motion access was denied. You can re-enable it in your browser settings.
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
