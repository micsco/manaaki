---
title: Assertions with jest-dom
impact: HIGH
impactDescription: better matchers produce clearer failure messages and encode intent
tags: assertions, jest-dom, waitFor, async
---

## Assertions with jest-dom

### Use jest-dom matchers

Always use `@testing-library/jest-dom` matchers. They produce dramatically better
failure messages than raw DOM property assertions.

**Incorrect: raw DOM property — poor error message**

```tsx
expect(checkbox.checked).toBe(true)
// Error: expect(received).toBe(expected)
//   Expected: true
//   Received: false
```

**Correct: jest-dom matcher — clear error message**

```tsx
expect(screen.getByRole("checkbox")).toBeChecked()
// Error: Received element is not checked:
//   <input type="checkbox" />
```

**Core matchers:**

| Matcher | Use for |
|---------|---------|
| `.toBeInTheDocument()` | Element is present in the DOM |
| `.not.toBeInTheDocument()` | Element is absent |
| `.toBeVisible()` | Element is visible (not hidden by CSS/display/visibility) |
| `.toBeChecked()` | `<input type="checkbox">` or radio is checked |
| `.not.toBeChecked()` | Checkbox is unchecked |
| `.toBeDisabled()` | Form element is disabled |
| `.not.toBeDisabled()` | Form element is enabled |
| `.toHaveTextContent(/pattern/)` | Text content matches regex |
| `.toHaveTextContent("exact")` | Text content is exact string |
| `.toHaveValue("text")` | Form field value |
| `.toHaveAttribute("attr", "val")` | Element attribute |
| `.toHaveFocus()` | Element has keyboard focus |
| `.toHaveClass("class-name")` | Element has a CSS class |
| `.toBeRequired()` | Form field is required |

---

### query* only for absence

`query*` variants return `null` instead of throwing when no element is found.
Use them **only** to assert something is absent from the DOM.

```tsx
// ✅ — correct: asserting absence
expect(screen.queryByRole("alert")).not.toBeInTheDocument()

// ❌ — wrong: use getByRole instead; query* gives a worse failure message
expect(screen.queryByRole("alert")).toBeInTheDocument()
// Error: "null isn't in the document" — which element? What went wrong?
```

When `getByRole` fails to find an element, it prints the entire DOM tree with
all available roles highlighted. That information is invaluable for debugging.
`queryByRole` + `toBeInTheDocument` suppresses it.

---

### Use find* for async elements

`find*` is `waitFor` + `get*`. It polls until the element appears or the timeout
expires. Prefer it over `waitFor(() => screen.getBy*(...))`.

```tsx
// ✅ — concise, better error message
const item = await screen.findByRole("listitem", { name: /pasta/i })

// ❌ — equivalent but verbose
const item = await waitFor(() => screen.getByRole("listitem", { name: /pasta/i }))
```

---

### waitFor rules

`waitFor` is for waiting until a specific assertion passes. Misuse leads to
flaky tests and hard-to-read failures.

**Rule 1: One assertion per waitFor callback**

```tsx
// ❌ — if the second assertion fails, you wait the full timeout
await waitFor(() => {
  expect(fetchMock).toHaveBeenCalledWith("/api/recipes")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

// ✅ — fail fast on the first; follow up synchronously
await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/recipes"))
expect(fetchMock).toHaveBeenCalledTimes(1)
```

**Rule 2: No side effects inside waitFor**

`waitFor` retries the callback on every DOM mutation and on a timer interval.
A side effect inside the callback fires multiple times.

```tsx
// ❌ — click may fire multiple times
await waitFor(() => {
  fireEvent.click(button)
  expect(screen.getByRole("dialog")).toBeInTheDocument()
})

// ✅
await user.click(button)
await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument())
```

**Rule 3: No empty waitFor callbacks**

```tsx
// ❌ — fragile; passes only by timing luck
await waitFor(() => {})
expect(fetchMock).toHaveBeenCalled()

// ✅ — wait for the actual condition
await waitFor(() => expect(fetchMock).toHaveBeenCalled())
```

**Rule 4: Don't use snapshot assertions inside waitFor**

`waitFor` may call the callback multiple times. Snapshot assertions inside it
can create false positives if the snapshot matches on an early retry.

```tsx
// ❌ — snapshot may match before the final state
await waitFor(() => expect(container).toMatchSnapshot())

// ✅ — wait for a known stable assertion first, then snapshot
await screen.findByText(/loaded/i)
expect(container).toMatchSnapshot()
```

---

### Make assertions explicit

`get*` throws on failure and prints the DOM. This is already informative. But
calling it without an `expect` leaves intent ambiguous — a reader can't tell
if it's a deliberate assertion or a query leftover from a refactor.

```tsx
// ✅ — intent is unambiguous
expect(screen.getByRole("heading", { name: /ingredients/i })).toBeInTheDocument()

// Acceptable but less clear
screen.getByRole("heading", { name: /ingredients/i })
```

Prefer the explicit form. It communicates to the reader that this is a deliberate
assertion, not a query variable that will be used later.
