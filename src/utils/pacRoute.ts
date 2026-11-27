export function pacRouteFor (proxy: { type: string; host: string; port: number }): string {
  const scheme = proxy.type === 'socks' ? 'SOCKS5' : 'PROXY'
  return `${scheme} ${proxy.host}:${proxy.port}`
}
