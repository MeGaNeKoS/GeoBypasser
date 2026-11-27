import type { ProxyListItem } from '@customTypes/proxy'
import type { WebRequest } from 'webextension-polyfill'
import { APP_NAME } from '@constant/defaults'
import { authCredentialsFor } from '@utils/proxy'

export type AuthChallenge = Pick<WebRequest.OnAuthRequiredDetailsType, 'isProxy' | 'challenger'>

export function answerProxyAuth (details: AuthChallenge, proxyList: ProxyListItem[]) {
  console.debug(`[${APP_NAME}BG] Auth required detected:`, details)

  const credentials = authCredentialsFor(details, proxyList)
  if (credentials) {
    console.debug(
      `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - providing proxy credentials.`)
    return { authCredentials: credentials }
  }

  console.debug(
    `[${APP_NAME}BG] Auth required for ${details.challenger.host}:${details.challenger.port} - no proxy credentials apply.`)
  return {}
}

export type ProxyAuthResponse = ReturnType<typeof answerProxyAuth>

export type ProxyListReady = <R>(use: (proxyList: ProxyListItem[]) => R) => Promise<R>

export function answerProxyAuthWhenReady (details: AuthChallenge, proxyListReady: ProxyListReady): Promise<ProxyAuthResponse> {
  return proxyListReady(proxyList => answerProxyAuth(details, proxyList)).catch(error => {
    console.error(`[${APP_NAME}BG] Auth challenge answered without credentials, the stored proxy list did not load:`, error)
    return {}
  })
}
