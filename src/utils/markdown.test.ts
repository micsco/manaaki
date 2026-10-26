import { describe, expect, it } from "vitest"

import { parseInline, parseMarkdown, resolveLink } from "./markdown"

describe("resolveLink", () => {
  it("opens Manaaki links inside the app, keeping query and hash", () => {
    expect(resolveLink("/recipes/ETN2PhQoRTyHaLQi6nO68A/potatoes")).toEqual({
      kind: "internal",
      pathname: "/recipes/ETN2PhQoRTyHaLQi6nO68A/potatoes",
      search: {},
      hash: "",
    })
    expect(
      resolveLink("https://manaaki.micsco.nz/recipes/ETN2PhQoRTyHaLQi6nO68A/x?cook=true#method")
    ).toEqual({
      kind: "internal",
      pathname: "/recipes/ETN2PhQoRTyHaLQi6nO68A/x",
      search: { cook: "true" },
      hash: "method",
    })
  })

  it("sends server paths to the server instead of the in-app router", () => {
    expect(resolveLink("https://manaaki.micsco.nz/api/auth/oauth")).toEqual({
      kind: "external",
      url: "https://manaaki.micsco.nz/api/auth/oauth",
    })
    expect(resolveLink("/api/auth/oauth")).toEqual({
      kind: "external",
      url: "https://manaaki.micsco.nz/api/auth/oauth",
    })
  })

  it("keeps other web addresses external", () => {
    expect(resolveLink("https://www.ocado.com/search?q=gouda")).toEqual({
      kind: "external",
      url: "https://www.ocado.com/search?q=gouda",
    })
  })

  it("refuses scripts, data and protocol-relative addresses", () => {
    expect(resolveLink("javascript:alert(1)")).toBeNull()
    expect(resolveLink("data:text/html,hi")).toBeNull()
    expect(resolveLink("//evil.example/x")).toBeNull()
    expect(resolveLink("not a url")).toBeNull()
  })
})

describe("parseInline", () => {
  it("parses bold, italic, code and links", () => {
    expect(parseInline("**Hot** *oven* `200C` [see](/recipes/a/b)")).toEqual([
      { type: "strong", children: [{ type: "text", text: "Hot" }] },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "oven" }] },
      { type: "text", text: " " },
      { type: "code", text: "200C" },
      { type: "text", text: " " },
      {
        type: "link",
        href: { kind: "internal", pathname: "/recipes/a/b", search: {}, hash: "" },
        children: [{ type: "text", text: "see" }],
      },
    ])
  })

  it("links bare web addresses without the trailing full stop", () => {
    expect(parseInline("From https://www.delish.com/x.")).toEqual([
      { type: "text", text: "From " },
      {
        type: "link",
        href: { kind: "external", url: "https://www.delish.com/x" },
        children: [{ type: "text", text: "https://www.delish.com/x" }],
      },
      { type: "text", text: "." },
    ])
  })

  it("leaves underscores inside words and unsafe links as text", () => {
    expect(parseInline("snake_case_name")).toEqual([{ type: "text", text: "snake_case_name" }])
    expect(parseInline("[click](javascript:alert(1))")).toEqual([{ type: "text", text: "click" }])
  })

  it("keeps brackets that belong to a link address", () => {
    expect(parseInline("[Gouda](https://en.wikipedia.org/wiki/Gouda_(cheese))")).toEqual([
      {
        type: "link",
        href: { kind: "external", url: "https://en.wikipedia.org/wiki/Gouda_(cheese)" },
        children: [{ type: "text", text: "Gouda" }],
      },
    ])
  })

  it("italicises underscores at the start of a line or after a space", () => {
    expect(parseInline("_fresh_ or a _dried_ bay leaf")).toEqual([
      { type: "em", children: [{ type: "text", text: "fresh" }] },
      { type: "text", text: " or a" },
      { type: "text", text: " " },
      { type: "em", children: [{ type: "text", text: "dried" }] },
      { type: "text", text: " bay leaf" },
    ])
  })
})

describe("parseMarkdown", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const blocks = parseMarkdown("First line\nsecond line\n\nNew paragraph")
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({
      type: "paragraph",
      lines: [[{ text: "First line" }], [{ text: "second line" }]],
    })
  })

  it("recognises bulleted and numbered lists", () => {
    expect(parseMarkdown("- one\n- two")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ])
    expect(parseMarkdown("1. one\n2) two")[0]).toMatchObject({ type: "list", ordered: true })
  })

  it("splits a line of text and the list under it into separate blocks", () => {
    expect(parseMarkdown("Swaps:\n- chicken breast\n- less honey")).toEqual([
      { type: "paragraph", lines: [[{ type: "text", text: "Swaps:" }]] },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "chicken breast" }], [{ type: "text", text: "less honey" }]],
      },
    ])
  })
})
