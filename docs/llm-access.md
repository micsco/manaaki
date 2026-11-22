# LLM and agent access

Manaaki is one household's recipe collection. These endpoints exist so the household's own assistants and agents can find and read its recipes. They are not for search engine optimisation.

## Saved recipes and attribution

Most recipes were saved from other websites. A recipe counts as saved from elsewhere when Mealie's `orgURL` holds an http(s) URL (`src/utils/recipeProvenance.ts`). For these recipes:

- every format credits and links the original: the HTML footer, JSON-LD (`isBasedOn` and `creditText`), and the Markdown frontmatter (`source_url`, `source_site`, `attribution`) and body
- the HTML carries `<meta name="robots" content="noindex">`, and the Markdown carries `X-Robots-Tag: noindex`
- `sitemap.xml` leaves them out

This way search engines send people to the original author rather than to our copy. Every format also gives Manaaki's canonical URL.

## Crawlers

`robots.txt` explains the policy in comments. Crawlers that only collect training data (`GPTBot`, `ClaudeBot`, `Applebot-Extended`, `CCBot`, `meta-externalagent`, `Bytespider`, `cohere-training-data-crawler`) are disallowed everywhere. `Google-Extended` is intentionally not disallowed because Google uses the same token to gate live Gemini URL fetching and grounding; our no-training preference for all other crawlers is declared via [Content Signals](https://contentsignals.org/) (`search=yes, ai-input=yes, ai-train=no`) in `robots.txt` and as a `Content-Signal` header on Markdown and `llms.txt` responses.

## Formats

| URL | What it is |
|-----|------------|
| `/llms.txt` | [llms.txt](https://llmstxt.org/) index: a summary of the policy, then one H2 section per category linking each recipe's `.md` |
| `/recipes` | Server-rendered HTML recipe list (also serves Markdown via `Accept: text/markdown`) and `rel="describedby"` pointing at `/llms.txt` |
| `/recipes/<id>/<slug>.md`, or the page URL with `Accept: text/markdown` | Markdown with YAML frontmatter (`title`, `description`, `canonical_url`, `source_url`, `source_site`, `attribution`, `image`, `servings`, `yield`, ISO 8601 `prep_time`/`cook_time`/`total_time`, `categories`, `tags`, `date_published`, `date_modified`) |
| Recipe HTML | schema.org `Recipe` JSON-LD, `rel="canonical"`, `rel="alternate" type="text/markdown"` and `rel="describedby"` pointing at `/llms.txt` |
| `/sitemap.xml` | The household's own recipes only |

Frontmatter values are written as JSON strings, which are valid YAML, so quotes and newlines in recipe text can't break the block.
