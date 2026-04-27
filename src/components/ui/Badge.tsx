import type { ReactNode } from "react"

interface BadgeProps {
  children: ReactNode
  variant?: "category" | "tag" | "rating"
  className?: string
}

export function Badge({ children, variant = "tag", className = "" }: BadgeProps) {
  const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"

  const variantClasses = {
    category: "bg-orange-900/30 text-orange-300 border border-orange-800/50",
    tag: "bg-gray-800 text-gray-300 border border-gray-700",
    rating: "bg-yellow-900/30 text-yellow-300 border border-yellow-800/50",
  }

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</span>
  )
}
