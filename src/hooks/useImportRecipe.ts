import { useMutation, useQueryClient } from "@tanstack/react-query"

import { parseRecipeUrlApiRecipesCreateUrlPost } from "../api/generated/sdk.gen"

export interface ImportRecipeVariables {
  url: string
  includeTags?: boolean
  includeCategories?: boolean
}

export function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    if ("detail" in error) {
      const detail = error.detail
      if (typeof detail === "string") {
        if (detail.toLowerCase().includes("could not validate credentials")) {
          return "You do not have permission to import recipes. Please sign in."
        }
        return detail
      }
      if (detail && typeof detail === "object") {
        if ("message" in detail && typeof detail.message === "string") {
          const msg = (detail as { message: string }).message
          if (msg === "HTTPException") {
            return "Unable to scrape recipe from this URL. Please verify the link and try again."
          }
          return msg
        }
      }
      if (Array.isArray(detail)) {
        const messages = detail
          .map(item => (typeof item === "object" && item && "msg" in item ? String(item.msg) : ""))
          .filter(Boolean)
          .join(", ")
        if (messages) return messages
      }
    }
    if ("message" in error && typeof error.message === "string") {
      return (error as { message: string }).message
    }
  }
  return "Unable to scrape recipe from this URL. Please verify the link and try again."
}

export function useImportRecipe() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      url,
      includeTags = true,
      includeCategories = true,
    }: ImportRecipeVariables) => {
      const response = await parseRecipeUrlApiRecipesCreateUrlPost({
        body: {
          url,
          includeTags,
          includeCategories,
        },
      })

      if (response.error || !response.data) {
        throw new Error(extractErrorMessage(response.error))
      }

      return response.data
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ["recipes"] })
    },
  })
}
