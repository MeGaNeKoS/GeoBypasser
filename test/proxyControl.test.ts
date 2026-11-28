import { proxyControlStateFor, canApplyPac, isProxyNotInEffect } from '../src/utils/proxyControl'

describe('proxy control state for each level of control', () => {
  it.each([
    ['controlled_by_this_extension', 'active'],
    ['controllable_by_this_extension', 'available'],
    ['controlled_by_other_extensions', 'overridden'],
    ['not_controllable', 'unavailable'],
  ] as const)('maps %s to %s', (levelOfControl, state) => {
    expect(proxyControlStateFor(levelOfControl)).toBe(state)
  })

  it('allows applying the PAC script only when control is available', () => {
    expect(canApplyPac('available')).toBe(true)
    expect(canApplyPac('active')).toBe(false)
    expect(canApplyPac('overridden')).toBe(false)
    expect(canApplyPac('unavailable')).toBe(false)
  })

  it.each(['overridden', 'unavailable'] as const)('treats %s control as not in effect', state => {
    expect(isProxyNotInEffect(state)).toBe(true)
  })

  it.each(['active', 'available'] as const)('treats %s control as in effect', state => {
    expect(isProxyNotInEffect(state)).toBe(false)
  })

  it('treats a state not yet read as in effect, with nothing to show', () => {
    expect(isProxyNotInEffect(undefined)).toBe(false)
  })
})
