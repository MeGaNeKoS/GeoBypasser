import { withAppliedSettings } from '@utils/importFiles'

describe('applied setting choices', () => {
  it('stores the imported value for every setting the user applied', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://old.example/' }
    const imported = { defaultProxy: 'p2', fallbackDirect: true, testProxyUrl: 'https://new.example/' }

    expect(withAppliedSettings(stored, imported, ['defaultProxy', 'fallbackDirect', 'testProxyUrl'])).toEqual(imported)
  })
})
