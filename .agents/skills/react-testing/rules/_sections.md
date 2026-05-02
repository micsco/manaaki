# Sections

This file defines all sections, their ordering, impact levels, and descriptions.
The section ID (in parentheses) is the filename prefix used to group rules.

---

## 1. Setup (setup)

**Impact:** CRITICAL
**Description:** Vitest configuration, jsdom environment, jest-dom matchers,
custom render wrapper with providers, TypeScript integration, and package scripts.
Getting setup right is the foundation for all other rules.

## 2. Query Strategy (queries)

**Impact:** HIGH
**Description:** How to query the DOM in tests. Always use `screen.*`, follow
the query priority hierarchy (`*ByRole` first), and use the correct variant
(`get*` / `query*` / `find*`) for each situation.

## 3. Interaction (interaction)

**Impact:** HIGH
**Description:** How to simulate user interactions. Use `@testing-library/user-event`
over `fireEvent`, never wrap calls in `act` manually, and handle async interactions
correctly.

## 4. Assertions (assertions)

**Impact:** HIGH
**Description:** How to assert on rendered output. Use `jest-dom` matchers,
use `query*` only for absence, use `find*` for async elements, and follow
strict `waitFor` rules.

## 5. Mocking (mocking)

**Impact:** HIGH
**Description:** How to mock dependencies. Mock at module boundaries, clear mocks
between tests, handle sessionStorage and browser APIs, and use the custom render
wrapper for context mocking.

## 6. Playwright E2E (playwright)

**Impact:** HIGH
**Description:** TypeScript Playwright configuration and patterns. Role-first
locators, network mocking with `route`, auto-waiting assertions, and CI integration.
