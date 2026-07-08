import { Toast } from "@base-ui/react/toast"

import { toastManager } from "../lib/toastManager"

export function AppToasts() {
  return (
    <Toast.Provider toastManager={toastManager}>
      <ToastList />
    </Toast.Provider>
  )
}

function ToastList() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex w-72 flex-col sm:right-6 sm:bottom-6">
        {toasts.map(toast => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] h-(--height) w-full origin-bottom transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] rounded-xl border border-gray-700 bg-gray-900 bg-clip-padding p-4 shadow-xl select-none [--gap:0.5rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.5rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-ending-style:opacity-0 data-expanded:h-(--toast-height) data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-limited:opacity-0 data-starting-style:transform-[translateY(150%)] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:transform-[translateY(150%)]"
          >
            <Toast.Content className="overflow-hidden transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100">
              <Toast.Title className="mb-0.5 text-sm leading-5 font-semibold text-gray-100" />
              <Toast.Description className="text-sm leading-5 text-gray-400" />
              {toast.actionProps && (
                <Toast.Action className="mt-3 inline-flex h-8 items-center justify-center rounded-lg bg-orange-600 px-3 text-sm font-medium text-white transition-colors hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-900 focus:outline-hidden" />
              )}
              <Toast.Close
                className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                aria-label="Close"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}

function CloseIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}
