export function exportNotice (count: number, noun: string, nounPlural = `${noun}s`): string {
  const plural = count === 1 ? noun : nounPlural
  return `Exported ${count} ${plural}. Usernames and passwords are included.`
}
