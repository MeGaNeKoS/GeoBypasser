export type Scheme = 'light' | 'dark'

export function currentScheme (): Scheme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
