export const DIRECT_ROUTE = 'DIRECT'

export function pacRouteFor (proxy: { type: string; host: string; port: number }): string {
  const scheme = proxy.type === 'socks' ? 'SOCKS5' : 'PROXY'
  return `${scheme} ${proxy.host}:${proxy.port}`
}

export function routeOfProxyInfo (info: { type: string; host?: string; port?: number }): string {
  if (info.host === undefined || info.port === undefined) return DIRECT_ROUTE
  return pacRouteFor({ type: info.type, host: info.host, port: info.port })
}
