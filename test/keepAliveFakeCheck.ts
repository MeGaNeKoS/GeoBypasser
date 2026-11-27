export function withFakeProxyCheck () {
  const actual = jest.requireActual('@adapters/firefox')
  const fakeProxyCheck = jest.fn()
  return {
    ...actual,
    fakeProxyCheck,
    firefoxKeepAlivePorts: () => ({ ...actual.firefoxKeepAlivePorts(), checkProxy: fakeProxyCheck }),
  }
}

export async function letBackgroundStart () {
  for (let i = 0; i < 20; i++) await Promise.resolve()
  jest.advanceTimersByTime(0)
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
