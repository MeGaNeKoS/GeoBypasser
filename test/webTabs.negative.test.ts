import { webTabsOf } from '@utils/webTabs'

describe('open web tabs, negative cases', () => {
  it('drops extension, browser and internal pages', () => {
    expect(webTabsOf([
      { id: 1, url: 'chrome://extensions/', title: 'Extensions' },
      { id: 2, url: 'chrome-extension://abc/dashboard.html' },
      { id: 3, url: 'about:blank' },
    ])).toEqual([])
  })

  it('drops a tab without an id or a url', () => {
    expect(webTabsOf([{ url: 'https://page.example/' }, { id: 4 }])).toEqual([])
  })
})
