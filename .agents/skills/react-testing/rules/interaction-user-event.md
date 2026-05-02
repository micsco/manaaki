---
title: Interaction — userEvent and act
impact: HIGH
impactDescription: realistic event sequences catch more bugs; manual act wrapping creates noise and hides real problems
tags: interaction, userEvent, fireEvent, act, async
---

## Interaction — userEvent and act

### Use userEvent over fireEvent

`@testing-library/user-event` fires the full sequence of events a real browser
fires for each interaction. `fireEvent` fires a single synthetic event.

**Incorrect: fireEvent fires only one event**

```tsx
// Fires only a change event — misses keydown, keypress, keyup, focus, blur
fireEvent.change(input, { target: { value: "flour" } })
```

**Correct: userEvent fires the full sequence**

```tsx
const user = userEvent.setup()
await user.type(input, "flour")
```

`userEvent.type` fires: focus → keydown → keypress → input → keyup, for each
character. Libraries that listen to keydown (e.g. keyboard shortcuts, autocomplete)
work correctly. Libraries that listen only to change events also work.

**Common userEvent methods:**

| Method | What it does |
|--------|-------------|
| `user.click(element)` | Hover → mousedown → focus → mouseup → click |
| `user.type(element, text)` | Full keyboard sequence per character |
| `user.clear(element)` | Selects all + deletes |
| `user.selectOptions(select, value)` | Clicks option in `<select>` |
| `user.tab()` | Keyboard tab navigation |
| `user.keyboard("{Enter}")` | Press a specific key |
| `user.hover(element)` | Mouse over |
| `user.unhover(element)` | Mouse out |

**Setup once per test or in beforeEach:**

```tsx
describe("IngredientCheckbox", () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  it("toggles checked state on click", async () => {
    render(<IngredientCheckbox recipeId="abc" ingredientIndex={0} ingredient="flour" />)

    await user.click(screen.getByRole("checkbox"))

    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("toggles back on second click", async () => {
    render(<IngredientCheckbox recipeId="abc" ingredientIndex={0} ingredient="flour" />)

    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("checkbox"))

    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })
})
```

---

### Do not wrap in act manually

`render`, `userEvent.*`, and `fireEvent.*` already wrap their work in `act`.
Adding another `act` around them is redundant.

**Incorrect:**

```tsx
act(() => { render(<Counter />) })

const button = screen.getByRole("button")
act(() => { user.click(button) })
```

**Correct:**

```tsx
render(<Counter />)
await user.click(screen.getByRole("button"))
```

**When you see an `act(...)` warning:**

This warning means a state update happened after the test completed — usually
from an unresolved promise, a timer, or an effect that runs after unmount. Fix
the root cause. Do not silence it by wrapping in `act`.

Common causes:
- A component fetches data on mount and the test doesn't wait for the fetch
- A timer fires after the test assertion
- An effect cleans up asynchronously after `unmount`

Fixes:
- Use `findBy*` to wait for async state changes
- Mock timers with `vi.useFakeTimers()` and advance them explicitly
- Ensure cleanup in the component's `useEffect` return

---

### Async interaction patterns

When an interaction triggers async work, wait for the resulting DOM change:

```tsx
// Cook mode toggle — synchronous URL update, immediate re-render
await user.click(screen.getByRole("button", { name: /cook mode/i }))
expect(screen.getByRole("button", { name: /exit cook mode/i })).toBeInTheDocument()

// Async confirmation message after submit
await user.click(submitButton)
const status = await screen.findByRole("status")
expect(status).toHaveTextContent(/saved/i)
```

For keyboard interaction with the IngredientCheckbox (which listens for
Enter/Space on the `<li>`):

```tsx
const listItem = screen.getByRole("listitem")
listItem.focus()
await user.keyboard("{Enter}")
expect(screen.getByRole("checkbox")).toBeChecked()
```
