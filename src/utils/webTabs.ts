export type TabSummary = { id?: number; url?: string; title?: string };

export type WebTab = { id: number; url: string; title: string; host: string };

const WEB_SCHEME_PATTERN = /^https?:\/\//

export function webTabsOf (tabs: TabSummary[]): WebTab[] {
  return tabs.flatMap(tab => {
    if (tab.id === undefined || tab.url === undefined || !WEB_SCHEME_PATTERN.test(tab.url)) return []
    return [{ id: tab.id, url: tab.url, title: tab.title ?? '', host: new URL(tab.url).hostname }]
  })
}
