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

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
  return <div className={`p-6 pb-4 ${className}`}>{children}</div>
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className = "" }: CardContentProps) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>
}

interface CardFooterProps {
  children: ReactNode
  className?: string
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
  return <div className={`border-gray-800 border-t p-6 pt-4 ${className}`}>{children}</div>
}
