import { useInstallation } from "../pwa/install"
import { Button } from "./ui/Button"

export function InstallApp() {
  const { standalone, available, ios, install } = useInstallation()
  if (standalone) return null
  return (
    <section
      aria-label="Install Manaaki"
      className="rounded-xl border border-gray-700 bg-gray-800/50 p-4"
    >
      <h2 className="mb-2 font-semibold text-gray-100">Manaaki on your home screen</h2>
      <p className="mb-3 text-sm leading-relaxed text-gray-300">
        Open straight into your kitchen. Recipes you use are kept offline automatically.
      </p>
      {available ? (
        <Button
          className="w-full"
          onClick={() => {
            void install()
          }}
        >
          Install Manaaki
        </Button>
      ) : (
        <p className="text-sm leading-relaxed text-gray-400">
          {ios
            ? "In Safari, open Share, choose Add to Home Screen, then Add."
            : "Open your browser’s menu and choose Install app or Add to Home Screen, if available."}
        </p>
      )}
    </section>
  )
}
