import { Icon as MdiIcon } from "@mdi/react"

interface IconProps {
  path: string
  size?: string | number
  className?: string
  "aria-hidden"?: boolean
}

export function Icon({ path, size = 1, className, "aria-hidden": ariaHidden }: IconProps) {
  return <MdiIcon path={path} size={size} className={className} aria-hidden={ariaHidden} />
}
