import type { ButtonProps as BaseUIButtonProps } from "@base-ui/react/button"
import { Button as BaseUIButton } from "@base-ui/react/button"
import type React from "react"

interface ButtonProps extends Omit<BaseUIButtonProps, "className"> {
  variant?: "primary" | "secondary" | "ghost"
  size?: "sm" | "md" | "lg"
  className?: string
  asChild?: boolean
  children: React.ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950"

  const variantClasses = {
    primary:
      "bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500 hover:shadow-lg hover:shadow-orange-900/20",
    secondary:
      "bg-gray-800 hover:bg-gray-700 text-gray-100 focus:ring-gray-500 border border-gray-700",
    ghost: "text-gray-300 hover:text-gray-100 hover:bg-gray-800 focus:ring-gray-500",
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

  return (
    <BaseUIButton className={classes} {...props}>
      {children}
    </BaseUIButton>
  )
}
