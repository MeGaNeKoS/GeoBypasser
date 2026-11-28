import { canRunProxyTests } from '../src/utils/proxyControl'

describe('proxy tests are refused while another extension or a policy controls proxy settings', () => {
  it.each([
    ['another extension controls proxy settings', 'overridden'],
    ['a browser policy controls proxy settings', 'unavailable'],
  ] as const)('refuses tests when %s', (_, state) => {
    expect(canRunProxyTests(state)).toBe(false)
  })
})
