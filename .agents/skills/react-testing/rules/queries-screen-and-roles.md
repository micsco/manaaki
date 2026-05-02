---
title: Query Strategy — screen and Roles
impact: HIGH
impactDescription: queries that mirror user behaviour catch more bugs and survive refactors
tags: queries, screen, roles, accessibility, rtl
---

## Query Strategy — screen and Roles

### Always use screen

`screen` queries against the entire rendered document. Always import it alongside
`render` and use `screen.*` for every query.

**Incorrect: destructuring from render**

```tsx
const { getByRole, getByText } = render(<MyComponent />)
```

This is legacy Enzyme style. It forces you to update the destructure every time
you add or remove a query in a test.

**Correct: use screen**

```tsx
render(<MyComponent />)
screen.getByRole("button", { name: /save/i })
screen.getByText(/ingredients/i)
```

Debugging: `screen.debug()` prints the current DOM. `screen.debug(element)` prints
a specific element.

---

### Query priority hierarchy

Use queries in this order. Higher priority = tests what users/screen readers see.

| Priority | Query | When to use |
|----------|-------|-------------|
| 1 | `*ByRole` | Almost everything — buttons, headings, checkboxes, inputs, lists |
| 2 | `*ByLabelText` | Form inputs with an associated `<label>` |
| 3 | `*ByPlaceholderText` | Inputs with no label (prefer fixing the label) |
| 4 | `*ByText` | Non-interactive text content |
| 5 | `*ByDisplayValue` | Current value of a form field |
| 6 | `*ByAltText` | Images |
| 7 | `*ByTitle` | Elements with a `title` attribute |
| 8 | `*ByTestId` | Escape hatch only — requires `data-testid` in production markup |

Frequent `*ByTestId` use is a signal the component has accessibility problems.

---

### Use ByRole for almost everything

`getByRole` matches the element's ARIA role and optionally its accessible name.
It works even when text is split across child elements.

```tsx
// ❌ — fails if text is split across <span>s
screen.getByText(/hello world/i)

// ✅ — works regardless of internal DOM structure
screen.getByRole("button", { name: /hello world/i })
```

Common implicit roles:

| Element | Role |
|---------|------|
| `<button>` | `button` |
| `<a href="...">` | `link` |
| `<input type="text">` | `textbox` |
| `<input type="checkbox">` | `checkbox` |
| `<h1>`–`<h6>` | `heading` |
| `<ul>`, `<ol>` | `list` |
| `<li>` | `listitem` |
| `<img alt="...">` | `img` |
| `<nav>` | `navigation` |
| `<section>` with label | `region` |

Do not add `role="button"` to a `<button>` — it is redundant. Trust implicit roles.

When `getByRole` fails, RTL logs all available roles in the error output. Read
that output — it tells you exactly what roles are present in the rendered tree.

The `name` option matches the accessible name — what a screen reader announces.
For a button, this is the text content or `aria-label`. For an input, this is
the associated label text.

---

### query* vs get* vs find*

| Variant | Returns | Throws if absent | Use when |
|---------|---------|-----------------|----------|
| `get*` | Element | Yes (immediately) | Element should be in DOM right now |
| `query*` | Element or null | No | Asserting element is NOT in DOM |
| `find*` | Promise\<Element\> | Yes (after timeout) | Element appears asynchronously |

```tsx
// ✅ asserting presence (synchronous)
expect(screen.getByRole("alert")).toBeInTheDocument()

// ✅ asserting absence — the only correct use of query*
expect(screen.queryByRole("alert")).not.toBeInTheDocument()

// ✅ element appears after async work
const alert = await screen.findByRole("alert")

// ❌ wrong variant — query* gives poor error message for presence assertions
expect(screen.queryByRole("alert")).toBeInTheDocument()

// ❌ unnecessary wrapping — find* already does this
const alert = await waitFor(() => screen.getByRole("alert"))
```
