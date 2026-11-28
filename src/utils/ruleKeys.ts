const RUNTIME_FIELD_PREFIX = 'compiled'
const ROW_FOCUS_CONTROLS = ['switch', 'edit', 'export', 'delete']

export function ruleKeyAt (list: readonly unknown[], index: number): string {
  const content = stableSerialize(list[index])
  const occurrence = list.slice(0, index).filter(rule => stableSerialize(rule) === content).length
  return `${content}#${occurrence}`
}

export function ruleKeysOf (list: readonly unknown[]): string[] {
  return list.map((_rule, index) => ruleKeyAt(list, index))
}

export function rowFocusKeyAfterChange (focusKey: string, previousKeys: string[], keys: string[]): string | undefined {
  for (const control of ROW_FOCUS_CONTROLS) {
    const position = previousKeys.findIndex(key => focusKey === `${control}-${key}`)
    if (position === -1) continue
    if (keys.includes(previousKeys[position])) return undefined
    if (keys.length === 0) return undefined
    return `${control}-${keys[Math.min(position, keys.length - 1)]}`
  }
  return undefined
}

function stableSerialize (value: unknown): string {
  return JSON.stringify(withSortedKeys(value))
}

function withSortedKeys (value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withSortedKeys)
  if (value === null || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record)
      .filter(key => !key.startsWith(RUNTIME_FIELD_PREFIX))
      .sort()
      .map(key => [key, withSortedKeys(record[key])]),
  )
}
