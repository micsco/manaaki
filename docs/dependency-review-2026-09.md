# Dependency review — September 2026

Updated the application and development dependencies to current stable versions, with deliberate exceptions for Node LTS compatibility and pnpm’s release-age policy. Reviewed release notes and adopted the changes below. The separately published navigation changes are included in final validation.

| Package | Previous | Updated |
| --- | --- | --- |
| @base-ui/react | ^1.6.0 | ^1.8.0 |
| @posthog/react | ^1.10.3 | ^1.10.5 |
| @tanstack/intent | ^0.3.5 | 0.3.8 (latest policy-eligible) |
| @tanstack/react-query | ^5.101.2 | ^5.102.8 |
| @tanstack/react-router | ^1.170.17 | ^1.170.32 |
| @tanstack/react-start | ^1.168.27 | ^1.168.49 |
| @tanstack/router-core | ^1.171.14 | ^1.171.27 |
| nuqs | ^2.9.0 | ^2.10.1 |
| posthog-node | ^5.40.0 | ^5.51.6 |
| react | ^19.2.7 | ^19.2.8 |
| react-dom | ^19.2.7 | ^19.2.8 |
| srvx | ^0.11.21 | ^1.0.3 |
| uuid | ^14.0.1 | ^14.0.2 |
| @j178/prek | ^0.4.8 | ^0.5.2 |
| @playwright/test | ^1.61.1 | ^1.63.0 |
| @tailwindcss/vite | ^4.3.2 | ^4.3.3 |
| @testing-library/dom | Added | ^10.4.1 |
| @testing-library/jest-dom | ^6.9.1 | ^7.0.1 |
| @testing-library/react | ^16.3.2 | ^16.3.3 |
| @testing-library/user-event | ^14.6.1 | ^14.6.7 |
| @types/node | ^26.1.0 | ^24.13.3 (runtime aligned) |
| @types/react | ^19.2.17 | ^19.2.18 |
| @types/react-dom | ^19.2.3 | ^19.2.7 |
| @vitejs/plugin-react | ^6.0.3 | ^6.1.1 |
| @vitest/coverage-v8 | ^4.1.10 | ^5.0.0 |
| jsdom | ^29.1.1 | ^30.0.1 |
| oxfmt | 0.58.0 | 0.66.0 |
| oxlint | ^1.73.0 | ^1.81.0 |
| tailwindcss | ^4.3.2 | ^4.3.3 |
| vite | ^8.1.3 | ^8.2.2 |
| vitest | ^4.1.10 | ^5.0.0 |

## Runtime, language and package manager

- Node **24.20.0 LTS** is selected through `.node-version`, CI and Docker. Node 26 is the newer current line; retained the supported LTS line for production. Node typings now match major 24 instead of exposing APIs unavailable in the runtime. [Official Node images](https://raw.githubusercontent.com/docker-library/official-images/master/library/node)
- TypeScript **7.0.2** was already current. Retained the OpenAPI generator’s tested TypeScript 6.0.3 dependency hook because openapi-ts 0.99 uses the JavaScript compiler API. A real local OpenAPI fixture generates successfully. Retained the ES2022 browser target; a newer server runtime alone does not justify raising browser requirements. [TypeScript release](https://github.com/microsoft/TypeScript/releases/tag/v7.0.2)
- Migrated pnpm **10.33.0 → 12.3.4**, moved overrides from package.json into `pnpm-workspace.yaml`, and regenerated its lockfile with a fresh install. Explicitly disallowed unnecessary core-js/protobufjs lifecycle builds with `allowBuilds`. The existing `.pnpmfile.cjs` hook remains supported. [pnpm release](https://github.com/pnpm/pnpm/releases/tag/v12.3.4), [configuration](https://pnpm.io/settings), [build policy](https://pnpm.io/settings/build)
- Intent 0.4.0 was too recent for pnpm’s default minimum release age at verification time. Updated to **0.3.8 exactly**, the newest policy-eligible version, without a policy exemption. An attempted exemption was rejected by automatic approval review; revisit the update after the release ages into policy.
- Retained the targeted js-yaml 4.3.2 override for the generator’s parser dependency. Removed the obsolete OpenTelemetry override after fresh dependency resolution eliminated that vulnerable branch. Audit reports zero vulnerabilities.

## Vitest and tests

Vitest **5.0.0** and matching coverage now use inline Node/DOM projects sharing root configuration, plus stable filesystem module caching. Server/API/pure utility tests run in Node; component and browser utility tests retain jsdom. Removed redundant `clearAllMocks` setup now that Vitest clears mock histories by default. The paginated recipe test uses argument-matched `vi.when` responses instead of depending on invocation order. Added `pnpm test:doctor` for future performance diagnostics. [Vitest 5 release](https://main.vitest.dev/blog/vitest-5), [migration](https://main.vitest.dev/guide/migration/)

Regression coverage includes shared storage updates, changing storage keys, stable object snapshots, native storage events, grouped selection, SSR defaults, fresh shake callbacks and wake locks resolving after unmount. Existing user interaction tests remain intact.

## Linting and formatting

- Oxlint **1.81.0** now runs type-aware checks using **oxlint-tsgolint 7.0.2001**. Fixed floating promises and receiver-sensitive method references exposed by those checks. Promise handling now waits for query invalidation where callers need completion and handles wake-lock cleanup failures. [Type-aware linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html), [release](https://github.com/oxc-project/oxc/releases/tag/oxlint_v1.81.0)
- React refs, purity and set-state-in-effect checks are enforced as **errors** after addressing the findings. Lint finishes with zero warnings. Type assertion and consistent-return rules remain disabled; mocked-method assertions have a test-only unbound-method exception.
- Oxfmt **0.66.0** now formats GitHub workflow YAML too. Retained its existing import, Tailwind class and package.json sorting instead of adding another formatter. [Release notes](https://github.com/oxc-project/oxc/releases/tag/oxfmt_v0.66.0)

## Application simplifications

- Replaced repeated mounted-state effects with TanStack `useHydrated` in navigation, recipe filtering, sharing and motion permission detection.
- Rebuilt session storage as a React `useSyncExternalStore` subscription with an SSR snapshot. Extracted shared group selection to remove duplicate ingredient/instruction header effects. Functional updates read the latest shared value, avoiding lost updates between consumers.
- Adopted React `useEffectEvent` for fresh shake callbacks without reinstalling event listeners; moved remaining render-time mutable writes into effects. [React API](https://react.dev/reference/react/useEffectEvent)
- Replaced the cook-mode custom boolean parser with nuqs `parseAsBoolean`. Its new generic React-adapter SSR seeding is unnecessary for the existing TanStack adapter. [nuqs 2.10 notes](https://github.com/47ng/nuqs/releases/tag/v2.10.0)
- Base UI 1.8 interaction/focus fixes apply automatically. New collection/toast APIs are not needed by current components. [Release notes](https://base-ui.com/react/overview/releases/v1-8-0)
- Reviewed Vite’s React plugin 6.1 compiler option; it is experimental, so it is not enabled as a blanket replacement for memoization. [Plugin changelog](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md)
- Kept the existing srvx server entry point with receiver-safe forwarding to the TanStack handler. [srvx 1.0 release](https://github.com/h3js/srvx/releases/tag/v1.0.0)

## CI and Docker

- Updated checkout to 7.0.1, setup-node to 7.0.0, upload-artifact to 7.0.1 and pnpm/action-setup to 6.1.0. Both workflows read `.node-version`; pnpm setup reads packageManager. Removed the redundant single-version CI matrix. [Checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.0.0), [artifacts](https://github.com/actions/upload-artifact/releases/tag/v7.0.1), [pnpm setup](https://github.com/pnpm/action-setup/releases/tag/v6.1.0)
- Pinned build image `node:24.20.0-alpine3.24` and stable runtime `nginx:1.30.4-alpine3.24` to matching Alpine releases. Copy the same Node binary into runtime with libstdc++; no separately versioned Alpine Node package. [Official nginx tags](https://raw.githubusercontent.com/docker-library/official-images/master/library/nginx)
- Docker dependency installation includes workspace policy and generator hook, uses an explicit cache store, and prunes development dependencies without lifecycle scripts. Entrypoint permissions use COPY --chmod. Build context excludes environment variants and local test outputs.
- Renamed the placeholder Deploy workflow to Production build validation (`production-build.yml`) and removed its simulated deployment messages with explicit user approval. Actual deployment is managed by Dokploy.
- Docker execution remains unverified because no Docker daemon is available. Image tags were verified against official manifests; entrypoint shell syntax passes. Existing process supervision and the secret-gated PostHog CLI step remain unchanged.

## Final verification

On Node 24.20.0 / pnpm 12.3.4, against the current checkout including published navigation changes:

- Frozen-lockfile installation passes with supply-chain policies intact.
- Lint and formatting pass with zero warnings.
- TypeScript check passes.
- **79 test files / 713 tests pass**, including coverage generation: **83.99% statements, 84.73% lines**.
- Client and server production builds pass.
- Local OpenAPI fixture generation passes.
- Built production server serves `/login` with HTTP 200 using localhost binding and a clean environment.
- Final audit reports zero vulnerabilities.
- Generated coverage and browser test output are excluded from Git and formatting checks.
- Publication and deployment are performed through the main branch and Dokploy after validation.
