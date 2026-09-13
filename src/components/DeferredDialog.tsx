import { Dialog } from "@base-ui/react/dialog"
import { Component, Suspense, type ReactNode } from "react"

function DialogStatus({ failed = false, onClose }: { failed?: boolean; onClose: () => void }) {
  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(90vw,24rem)] -translate-1/2 rounded-2xl border border-gray-700 bg-gray-900 p-6 text-gray-100">
          <Dialog.Title className="text-lg font-semibold">
            {failed ? "Couldn't open this dialog" : "Loading…"}
          </Dialog.Title>
          <Dialog.Description
            role={failed ? "alert" : "status"}
            className="mt-2 text-sm text-gray-400"
          >
            {failed
              ? "Check your connection, then reload the page to try again."
              : "Opening your controls…"}
          </Dialog.Description>
          <div className="mt-4 flex gap-3">
            <Dialog.Close className="min-h-11 rounded-lg bg-gray-800 px-4">Cancel</Dialog.Close>
            {failed && (
              <button
                className="min-h-11 rounded-lg bg-orange-600 px-4"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

class DialogErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <DialogStatus failed onClose={this.props.onClose} />
    ) : (
      this.props.children
    )
  }
}

export function DeferredDialog({
  children,
  onClose,
}: {
  children: ReactNode
  onClose: () => void
}) {
  return (
    <DialogErrorBoundary onClose={onClose}>
      <Suspense fallback={<DialogStatus onClose={onClose} />}>{children}</Suspense>
    </DialogErrorBoundary>
  )
}
