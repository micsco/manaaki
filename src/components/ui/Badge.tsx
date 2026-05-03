import type { ReactNode } from "react"

interface BadgeProps {
  children: ReactNode
  variant?: "category" | "tag" | "rating" | "overlay" | "overlay-highlight"
  className?: string
}

export function Badge({ children, variant = "tag", className = "" }: BadgeProps) {
  const baseClasses = "px-3 py-1 rounded-full text-sm font-medium"

  const variantClasses = {
    category: "bg-orange-900/30 text-orange-300 border border-orange-800/50",
    tag: "bg-gray-800 text-gray-300 border border-gray-700",
    rating: "bg-yellow-900/30 text-yellow-300 border border-yellow-800/50",
    overlay: "bg-black/40 text-white backdrop-blur-sm border border-white/10",
    "overlay-highlight": "bg-orange-600/80 text-white backdrop-blur-sm border border-orange-500/50",
  }

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>{children}</span>
  )
}
