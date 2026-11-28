import { webTabsOf } from '@utils/webTabs'

describe('open web tabs', () => {
  it('keeps http and https tabs with their host and title', () => {
    const tabs = webTabsOf([
      { id: 1, url: 'https://page.example/home', title: 'Home' },
      { id: 2, url: 'http://plain.example/' },
    ])

    expect(tabs).toEqual([
      { id: 1, url: 'https://page.example/home', title: 'Home', host: 'page.example' },
      { id: 2, url: 'http://plain.example/', title: '', host: 'plain.example' },
    ])
  })
})
