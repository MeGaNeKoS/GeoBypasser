export function ruleKeyAt (list: readonly unknown[], index: number): string {
  const content = stableSerialize(list[index])
  const occurrence = list.slice(0, index).filter(rule => stableSerialize(rule) === content).length
  return `${content}#${occurrence}`
}

function stableSerialize (value: unknown): string {
  return JSON.stringify(withSortedKeys(value))
}

function withSortedKeys (value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSortedKeys)
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(Object.keys(record).sort().map(key => [key, withSortedKeys(record[key])]))
}
