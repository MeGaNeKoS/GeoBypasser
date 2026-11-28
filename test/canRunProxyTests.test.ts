import { canRunProxyTests } from '../src/utils/proxyControl'

describe('proxy tests can run while GeoBypass controls or can take control of proxy settings', () => {
  it.each([
    ['no control state, as on Firefox', undefined],
    ['this extension is in control', 'active'],
    ['this extension can take control', 'available'],
  ] as const)('allows tests when %s', (_, state) => {
    expect(canRunProxyTests(state)).toBe(true)
  })
})
