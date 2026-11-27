const ALL_URLS = '<all_urls>'
const ALL_URLS_SCHEMES = ['http', 'https', 'file', 'ftp']
const WILDCARD_SCHEME_SOURCE = 'https?'
const WILDCARD_HOST_SOURCE = '[^/?#:@]+'
const WILDCARD_SUBDOMAIN_PREFIX_SOURCE = '(?:[^./?#:@]+\\.)*'
const USERINFO_SOURCE = '(?:[^/?#@]*@)?'
const PORT_AND_END_SOURCE = '(?::[0-9]*)?(?=[/?#]|$)'
const SCHEME_AND_HOST = /^([^:/]+):\/\/([^/]*)/

export function matchPatternSource (pattern: string): string {
  if (pattern === ALL_URLS) return `^(?:${ALL_URLS_SCHEMES.join('|')}):`
  const [, scheme, host] = splitSchemeAndHost(pattern)
  return `^${schemeSource(scheme)}://${USERINFO_SOURCE}${hostSource(host)}${PORT_AND_END_SOURCE}`
}

function splitSchemeAndHost (pattern: string): string[] {
  const parts = SCHEME_AND_HOST.exec(pattern)
  if (parts === null) throw new Error(`Not a match pattern: ${pattern}`)
  return parts
}

function schemeSource (scheme: string): string {
  return scheme === '*' ? WILDCARD_SCHEME_SOURCE : escapeRegExp(scheme)
}

function hostSource (host: string): string {
  if (host === '*') return WILDCARD_HOST_SOURCE
  if (host.startsWith('*.')) return `${WILDCARD_SUBDOMAIN_PREFIX_SOURCE}${escapeRegExp(host.slice(2).toLowerCase())}`
  return escapeRegExp(host.toLowerCase())
}

function escapeRegExp (text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
