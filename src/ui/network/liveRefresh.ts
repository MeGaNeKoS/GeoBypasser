export function refreshInBackground (refresh: () => Promise<void>, reason: string): void {
  refresh().catch(error => console.error(reason, error));
}
