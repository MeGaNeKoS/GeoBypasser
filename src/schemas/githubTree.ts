import { z } from 'zod'

const GitHubTreeEntrySchema = z.object({
  path: z.string(),
  type: z.string(),
})

const GitHubTreeResponseSchema = z.object({
  tree: z.array(z.unknown()),
})

export type GitHubTreeEntry = z.infer<typeof GitHubTreeEntrySchema>

export function parseGitHubTreeEntries (response: unknown): GitHubTreeEntry[] {
  const parsed = GitHubTreeResponseSchema.safeParse(response)
  if (!parsed.success) return []
  return parsed.data.tree.flatMap(entry => {
    const checked = GitHubTreeEntrySchema.safeParse(entry)
    return checked.success ? [checked.data] : []
  })
}
