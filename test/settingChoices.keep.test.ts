import { withAppliedSettings } from '@utils/importFiles'

describe('kept setting choices', () => {
  it('keeps the stored value of every setting the user did not apply', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://old.example/' }
    const imported = { defaultProxy: 'p2', fallbackDirect: true, testProxyUrl: 'https://new.example/' }

    expect(withAppliedSettings(stored, imported, [])).toEqual(stored)
  })

  it('keeps the stored value of a setting while applying another', () => {
    const stored = { defaultProxy: 'p1', fallbackDirect: false, testProxyUrl: 'https://old.example/' }
    const imported = { defaultProxy: 'p2', fallbackDirect: true, testProxyUrl: 'https://new.example/' }

    expect(withAppliedSettings(stored, imported, ['fallbackDirect'])).toEqual({
      defaultProxy: 'p1',
      fallbackDirect: true,
      testProxyUrl: 'https://old.example/',
    })
  })
})
