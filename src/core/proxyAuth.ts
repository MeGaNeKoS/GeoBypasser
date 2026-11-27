import type { ProxyListItem } from '@customTypes/proxy'
import type { WebRequest } from 'webextension-polyfill'
import { APP_NAME } from '@constant/defaults'
import { authCredentialsFor } from '@utils/proxy'

type AuthChallenge = Pick<WebRequest.OnAuthRequiredDetailsType, 'isProxy' | 'challenger'>

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

export function createProxyAuthListener (currentProxyList: () => ProxyListItem[]) {
  return (details: AuthChallenge) => answerProxyAuth(details, currentProxyList())
}
