/**
 * Subtle footer showing the git SHA and build time of the running bundle.
 * Values come from VITE_BUILD_* env vars baked in by the Dockerfile;
 * in `vite dev` they're undefined, so the whole footer stays hidden.
 */
export function BuildInfo() {
  const shortSha = import.meta.env.VITE_BUILD_GIT_SHORT_SHA
  const fullSha = import.meta.env.VITE_BUILD_GIT_SHA
  const buildTime = import.meta.env.VITE_BUILD_TIME

  if (!shortSha) return null

  const formattedDate = buildTime ? buildTime.slice(0, 10) : null
  const commitUrl = fullSha ? `https://github.com/micsco/manaaki/commit/${fullSha}` : null

  return (
    <footer className="px-4 py-3 text-center font-mono text-gray-500 text-xs">
      {commitUrl ? (
        <a
          href={commitUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-gray-300"
          title={fullSha}
        >
          {shortSha}
        </a>
      ) : (
        <span>{shortSha}</span>
      )}
      {formattedDate && (
        <>
          <span className="mx-2">·</span>
          <span>deployed {formattedDate}</span>
        </>
      )}
    </footer>
  )
}
