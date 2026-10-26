export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; text: string }
  | { type: "link"; href: LinkTarget; children: InlineNode[] }

export type BlockNode =
  | { type: "paragraph"; lines: InlineNode[][] }
  | { type: "list"; ordered: boolean; items: InlineNode[][] }

export type LinkTarget =
  | { kind: "internal"; pathname: string; search: Record<string, string>; hash: string }
  | { kind: "external"; url: string }

const APP_ORIGIN = "https://manaaki.micsco.nz"
const APP_HOSTS = new Set([new URL(APP_ORIGIN).hostname])
const SERVER_PATH = /^\/(?:api|ingest)(?:\/|$)/
const BULLET = /^\s*[-*+]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/
const INLINE =
  /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(?!\s)(.+?)\*|(^|[^\w])_(?!\s)(.+?)_(?!\w)|(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g

function internalTarget(url: URL): LinkTarget {
  if (SERVER_PATH.test(url.pathname)) return { kind: "external", url: url.href }
  return {
    kind: "internal",
    pathname: url.pathname,
    search: Object.fromEntries(url.searchParams),
    hash: url.hash.replace(/^#/, ""),
  }
}

export function resolveLink(raw: string): LinkTarget | null {
  const href = raw.trim()
  if (href.startsWith("/") && !href.startsWith("//"))
    return internalTarget(new URL(href, APP_ORIGIN))
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (APP_HOSTS.has(url.hostname)) return internalTarget(url)
  return { kind: "external", url: url.href }
}

function linkNode(rawHref: string, children: InlineNode[], fallback: string): InlineNode {
  const href = resolveLink(rawHref)
  return href ? { type: "link", href, children } : { type: "text", text: fallback }
}

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const start = match.index ?? 0
    if (start > last) nodes.push({ type: "text", text: text.slice(last, start) })
    const [
      whole,
      linkText,
      linkHref,
      strongA,
      strongB,
      code,
      emStar,
      emLead,
      emUnderscore,
      bareUrl,
    ] = match
    if (linkText !== undefined && linkHref !== undefined) {
      nodes.push(linkNode(linkHref, parseInline(linkText), linkText))
    } else if (strongA !== undefined || strongB !== undefined) {
      nodes.push({ type: "strong", children: parseInline(strongA ?? strongB) })
    } else if (code !== undefined) {
      nodes.push({ type: "code", text: code })
    } else if (emStar !== undefined) {
      nodes.push({ type: "em", children: parseInline(emStar) })
    } else if (emUnderscore !== undefined) {
      if (emLead) nodes.push({ type: "text", text: emLead })
      nodes.push({ type: "em", children: parseInline(emUnderscore) })
    } else if (bareUrl !== undefined) {
      nodes.push(linkNode(bareUrl, [{ type: "text", text: bareUrl }], bareUrl))
    } else {
      nodes.push({ type: "text", text: whole })
    }
    last = start + whole.length
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) })
  return nodes
}

type LineKind = "bullet" | "numbered" | "text"

function lineKind(line: string): LineKind {
  if (BULLET.test(line)) return "bullet"
  if (NUMBERED.test(line)) return "numbered"
  return "text"
}

function toBlock(kind: LineKind, lines: string[]): BlockNode {
  if (kind === "text")
    return { type: "paragraph", lines: lines.map(line => parseInline(line.trim())) }
  const marker = kind === "bullet" ? BULLET : NUMBERED
  return {
    type: "list",
    ordered: kind === "numbered",
    items: lines.map(line => parseInline(line.replace(marker, ""))),
  }
}

function splitByKind(lines: string[]): BlockNode[] {
  const blocks: BlockNode[] = []
  let kind: LineKind | null = null
  let run: string[] = []
  for (const line of lines) {
    const next = lineKind(line)
    if (kind !== null && next !== kind) {
      blocks.push(toBlock(kind, run))
      run = []
    }
    kind = next
    run.push(line)
  }
  if (kind !== null) blocks.push(toBlock(kind, run))
  return blocks
}

export function parseMarkdown(source: string): BlockNode[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map(block => block.split("\n").filter(line => line.trim()))
    .flatMap(splitByKind)
}
