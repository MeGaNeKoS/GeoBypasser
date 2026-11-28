import { controlNoticeFor, controlWarningCopy } from '../src/utils/controlNotice'

describe('control notice for a proxy control state that is not in effect', () => {
  it('warns when another extension controls the proxy settings on first load', () => {
    expect(controlNoticeFor(undefined, 'overridden')).toEqual({ kind: 'warning', state: 'overridden' })
  })

  it('warns when the browser policy controls the proxy settings', () => {
    expect(controlNoticeFor('available', 'unavailable')).toEqual({ kind: 'warning', state: 'unavailable' })
  })

  it('reports that GeoBypass is routing again once control returns', () => {
    expect(controlNoticeFor('overridden', 'available')).toEqual({ kind: 'restored' })
  })

  it('offers the extensions page only for another extension', () => {
    expect(controlWarningCopy('overridden').actionLabel).toBe('Open extensions page')
    expect(controlWarningCopy('unavailable').actionLabel).toBeUndefined()
  })
})
