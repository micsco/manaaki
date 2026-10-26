import { mdiChevronLeft, mdiChevronRight } from "@mdi/js"
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"

import { Icon } from "./Icon"

interface ScrollEdges {
  canScrollBack: boolean
  canScrollForward: boolean
}

const EDGE_TOLERANCE_PX = 1

function measureEdges(list: HTMLElement): ScrollEdges {
  const maxScrollLeft = list.scrollWidth - list.clientWidth
  return {
    canScrollBack: list.scrollLeft > EDGE_TOLERANCE_PX,
    canScrollForward: list.scrollLeft < maxScrollLeft - EDGE_TOLERANCE_PX,
  }
}

function fadeFor({ canScrollBack, canScrollForward }: ScrollEdges) {
  if (canScrollBack && canScrollForward) return "both"
  if (canScrollBack) return "start"
  if (canScrollForward) return "end"
  return undefined
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
}

function ScrollButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full border border-gray-800 text-gray-400 transition-colors hover:border-gray-700 hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-2 focus-visible:outline-orange-400 disabled:pointer-events-none disabled:opacity-30 motion-reduce:transition-none"
    >
      <Icon path={icon} size={0.85} aria-hidden />
    </button>
  )
}

export function ScrollRow({
  title,
  headingId,
  children,
}: {
  title: string
  headingId: string
  children: ReactNode
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState<ScrollEdges>({
    canScrollBack: false,
    canScrollForward: false,
  })

  const updateEdges = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const next = measureEdges(list)
    setEdges(previous =>
      previous.canScrollBack === next.canScrollBack &&
      previous.canScrollForward === next.canScrollForward
        ? previous
        : next
    )
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    updateEdges()
    const observer = new ResizeObserver(updateEdges)
    observer.observe(list)
    return () => observer.disconnect()
  }, [updateEdges])

  function scrollPage(direction: 1 | -1) {
    const list = listRef.current
    if (!list) return
    const gap = Number.parseFloat(getComputedStyle(list).columnGap) || 0
    list.scrollBy({
      left: direction * (list.clientWidth + gap),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    })
  }

  const overflows = edges.canScrollBack || edges.canScrollForward

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 id={headingId} className="font-serif text-2xl font-bold text-gray-100">
          {title}
        </h2>
        {overflows && (
          <div className="hidden gap-1.5 any-pointer-fine:flex">
            <ScrollButton
              label={`Scroll ${title} back`}
              icon={mdiChevronLeft}
              disabled={!edges.canScrollBack}
              onClick={() => scrollPage(-1)}
            />
            <ScrollButton
              label={`Scroll ${title} forward`}
              icon={mdiChevronRight}
              disabled={!edges.canScrollForward}
              onClick={() => scrollPage(1)}
            />
          </div>
        )}
      </div>
      <ul
        ref={listRef}
        onScroll={updateEdges}
        data-fade={fadeFor(edges)}
        className="scroll-row flex snap-x snap-proximity gap-4 overflow-x-auto pt-1 pb-3 lg:gap-6"
        aria-label={title}
      >
        {children}
      </ul>
    </section>
  )
}
