interface PullDownPhotoProps {
  src: string
  alt: string
  isOpen: boolean
}

export function PullDownPhoto({ src, alt, isOpen }: PullDownPhotoProps) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden">
        <img
          src={src}
          alt={alt}
          className="mb-4 w-full"
          style={{ display: "block", maxHeight: "90vh", objectFit: "contain" }}
          draggable={false}
        />
      </div>
    </div>
  )
}
