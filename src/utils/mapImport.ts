export function duplicateKeysOf (stored: Record<string, unknown>, incoming: Record<string, unknown>): string[] {
  const storedKeys = new Set(Object.keys(stored))
  return Object.keys(incoming).filter(key => storedKeys.has(key))
}

export function mapAfterImport<T> (stored: Record<string, T>, incoming: Record<string, T>, replacedKeys: readonly string[]): Record<string, T> {
  const storedKeys = new Set(Object.keys(stored))
  const accepted = Object.entries(incoming).filter(([key]) => !storedKeys.has(key) || replacedKeys.includes(key))
  return { ...stored, ...Object.fromEntries(accepted) }
}
