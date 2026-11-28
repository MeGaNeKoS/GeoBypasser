import { controlNoticeFor } from '../src/utils/controlNotice'

describe('control notice when nothing is out of control', () => {
  it('shows nothing before the first state resolves', () => {
    expect(controlNoticeFor(undefined, undefined)).toEqual({ kind: 'none' })
  })

  it('does not report routing again on first load', () => {
    expect(controlNoticeFor(undefined, 'active')).toEqual({ kind: 'none' })
  })

  it('shows nothing while control stays with GeoBypass', () => {
    expect(controlNoticeFor('active', 'available')).toEqual({ kind: 'none' })
  })

  it('shows nothing when the state becomes unknown', () => {
    expect(controlNoticeFor('overridden', undefined)).toEqual({ kind: 'none' })
  })
})
