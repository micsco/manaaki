// @hey-api/openapi-ts 0.99 still drives the TypeScript compiler API (ts.SyntaxKind, ts.factory),
// which the Go-based TypeScript 7 package no longer ships. Give the generator its own TS 6 so the
// app can stay on TS 7.
const OPENAPI_TS_TYPESCRIPT_VERSION = "6.0.3"

function readPackage(pkg) {
  if (pkg.name !== "@hey-api/openapi-ts") return pkg
  const { typescript: _peerRange, ...peerDependencies } = pkg.peerDependencies ?? {}
  return {
    ...pkg,
    peerDependencies,
    dependencies: { ...pkg.dependencies, typescript: OPENAPI_TS_TYPESCRIPT_VERSION },
  }
}

module.exports = { hooks: { readPackage } }
