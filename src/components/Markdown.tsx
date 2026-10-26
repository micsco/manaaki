import { Link } from "@tanstack/react-router"
import { Fragment, type ReactNode } from "react"

import { type BlockNode, type InlineNode, parseMarkdown } from "../utils/markdown"

const linkClass = "text-orange-400 underline underline-offset-2 hover:text-orange-300"

function renderNode(node: InlineNode): ReactNode {
  switch (node.type) {
    case "text":
      return node.text
    case "strong":
      return <strong className="font-semibold text-gray-100">{renderInline(node.children)}</strong>
    case "em":
      return <em>{renderInline(node.children)}</em>
    case "code":
      return <code className="rounded bg-gray-800 px-1 py-0.5 text-sm">{node.text}</code>
    case "link":
      return node.href.kind === "internal" ? (
        <Link
          to={node.href.pathname}
          search={node.href.search}
          hash={node.href.hash || undefined}
          className={linkClass}
        >
          {renderInline(node.children)}
        </Link>
      ) : (
        <a href={node.href.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {renderInline(node.children)}
        </a>
      )
  }
}

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, index) => (
    // eslint-disable-next-line react/no-array-index-key -- inline pieces come from static note text with no ids
    <Fragment key={index}>{renderNode(node)}</Fragment>
  ))
}

function renderBlock(block: BlockNode, index: number): ReactNode {
  if (block.type === "list") {
    const ListTag = block.ordered ? "ol" : "ul"
    return (
      <ListTag
        key={index}
        className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}
      >
        {block.items.map((item, itemIndex) => (
          // eslint-disable-next-line react/no-array-index-key -- list items come from static note text with no ids
          <li key={itemIndex}>{renderInline(item)}</li>
        ))}
      </ListTag>
    )
  }
  return (
    <p key={index}>
      {block.lines.map((line, lineIndex) => (
        // eslint-disable-next-line react/no-array-index-key -- lines come from static note text with no ids
        <Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {renderInline(line)}
        </Fragment>
      ))}
    </p>
  )
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  return <div className={`space-y-3 ${className}`}>{parseMarkdown(source).map(renderBlock)}</div>
}
