export const SELECT_TRIGGER_CLASS = [
  "flex items-center gap-1 text-gray-400 transition-colors",
  "hover:text-gray-200",
  "focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-gray-950",
  "data-popup-open:text-gray-200",
].join(" ")

export const SELECT_POPUP_CLASS = [
  "min-w-36 rounded-xl border border-gray-700 bg-gray-900 py-1 shadow-black/40 shadow-xl",
  "origin-(--transform-origin) transition-[transform,scale,opacity]",
  "data-ending-style:scale-95 data-ending-style:opacity-0",
  "data-starting-style:scale-95 data-starting-style:opacity-0",
  "focus:outline-hidden",
].join(" ")

export const SELECT_ITEM_CLASS = [
  "flex cursor-pointer items-center gap-2 py-2 pr-4 pl-3 text-sm transition-colors",
  "text-gray-300 hover:bg-gray-800 hover:text-gray-100",
  "data-selected:font-semibold data-selected:text-orange-400",
  "data-highlighted:bg-gray-800 data-highlighted:text-gray-100",
  "focus:outline-hidden",
].join(" ")
