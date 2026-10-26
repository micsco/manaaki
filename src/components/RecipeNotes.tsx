import type { RecipeOutput } from "../api/generated/types.gen"
import { Markdown } from "./Markdown"

export function RecipeNotes({ notes }: { notes: NonNullable<RecipeOutput["notes"]> }) {
  if (notes.length === 0) return null
  return (
    <section className="mt-8 rounded-lg bg-gray-900 p-6">
      <h2 className="mb-4 text-xl font-semibold text-gray-100">Notes</h2>
      {notes.map((note, i) => (
        <div key={note.title ?? i} className="mb-4 last:mb-0">
          {note.title && <h3 className="mb-2 font-semibold text-gray-200">{note.title}</h3>}
          <Markdown source={note.text} className="text-gray-300" />
        </div>
      ))}
    </section>
  )
}
