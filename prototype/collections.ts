export function upsert<T extends { id: string }> (list: T[], item: T): void {
  const index = list.findIndex(existing => existing.id === item.id)
  if (index === -1) list.push(item)
  else list[index] = item
}

export function removeIds<T extends { id: string }> (list: T[], ids: string[]): void {
  const kept = list.filter(item => !ids.includes(item.id))
  list.splice(0, list.length, ...kept)
}

export function newId (prefix: string): string {
  return `${prefix}-${Date.now()}`
}
