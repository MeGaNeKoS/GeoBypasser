export const failures: string[] = []

export function expect (condition: boolean, message: string): void {
  if (!condition) failures.push(message)
}
