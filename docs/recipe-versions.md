# Recipe versions

Some recipes have a separate version for another appliance, such as an air fryer
version of an oven bake. Mealie has no built-in way to group them, so each version
is its own recipe and the versions point at each other through Mealie's recipe
`extras`.

## Linking two versions

Add the other recipe's UUID (its `id` from the Mealie API, not its slug) to each
recipe's `extras`:

| Key | Points to |
|-----|-----------|
| `ovenVersion` | The oven version |
| `airFryerVersion` | The air fryer version |
| `slowCookerVersion` | The slow cooker version |

Each recipe's own method comes from its tools: the `Air Fryer` or `Slow Cooker`
tool, otherwise oven. So the air fryer version should have the `Air Fryer` tool and
an `ovenVersion` key, and the oven version an `airFryerVersion` key. If a recipe
links to the method its tools suggest (an air fryer copy missing its tool but
pointing at the oven version), it is treated as the first method it doesn't link to.

IDs are used rather than slugs because Mealie changes a recipe's slug when it is
renamed.

When at least one linked version exists in the recipe list, the recipe page shows
an Oven / Air fryer / Slow cooker switch above the times. A link to a missing
recipe, or to the recipe itself, is ignored.

## Notes

Recipe notes render a small, safe subset of markdown: paragraphs, line breaks,
bold, italic, inline code, bulleted and numbered lists, and links. HTML is shown as
text. Links to `https://manaaki.micsco.nz/...` or to a path starting with `/` open
inside Manaaki, keeping any query and `#` section; `/api/...` links go to the server
instead. Other `http(s)` links open in a new tab; anything else is shown as plain
text. A blank line starts a new paragraph, and a list can follow a line of text
directly. Link to recipes with their Manaaki address, which carries the recipe
ID, so the link keeps working after a rename.
