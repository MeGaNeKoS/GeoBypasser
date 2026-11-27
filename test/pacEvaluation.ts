export function evaluatePac (script: string, url: string): string {
  const host = new URL(url).hostname
  const dnsDomainIs = (hostname: string, domain: string) => hostname.endsWith(domain)
  const findProxyForUrl = new Function(
    'dnsDomainIs',
    'url',
    'host',
    `${script}\nreturn FindProxyForURL(url, host);`,
  )
  return findProxyForUrl(dnsDomainIs, url, host)
}
