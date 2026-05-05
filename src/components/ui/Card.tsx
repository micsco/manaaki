import type { ReactNode } from "react"

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
}

export function Card({ children, className = "", hover = false }: CardProps) {
  const baseClasses = "rounded-lg border border-gray-800 bg-gray-900"
  const hoverClasses = hover
    ? "hover:bg-gray-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    : ""

  return <div className={`${baseClasses} ${hoverClasses} ${className}`}>{children}</div>
}
