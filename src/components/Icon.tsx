interface IconProps {
  path: string
  size?: string | number
  className?: string
  "aria-hidden"?: boolean
}

export function Icon({ path, size = 1, className, "aria-hidden": ariaHidden }: IconProps) {
  const dim = typeof size === "number" ? `${size * 1.5}rem` : size
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative icons pass aria-hidden; informative icons are handled by surrounding text
    <svg
      viewBox="0 0 24 24"
      width={dim}
      height={dim}
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d={path} fill="currentColor" />
    </svg>
  )
}
