import { isBareHostname } from '@utils/validity'

export type SiteMap = Record<string, string>

export type SiteForm = {
  domain: string;
  proxyId: string;
}

export type SiteFault = {
  field: keyof SiteForm;
  message: string;
}

const DOMAIN_FAULT = 'Domain is not a valid host name, such as example.com.'
const PROXY_FAULT = 'No proxy is chosen for this site.'

export function siteFormFaults (form: SiteForm): SiteFault[] {
  return [
    ...(isBareHostname(form.domain) ? [] : [{ field: 'domain' as const, message: DOMAIN_FAULT }]),
    ...(form.proxyId !== '' ? [] : [{ field: 'proxyId' as const, message: PROXY_FAULT }]),
  ]
}

export function siteMapAfterSave (map: SiteMap, form: SiteForm, previousDomain: string | undefined): SiteMap {
  const others = Object.entries(map).filter(([domain]) => domain !== previousDomain)
  return { ...Object.fromEntries(others), [form.domain]: form.proxyId }
}

export function siteMapWithout (map: SiteMap, domains: string[]): SiteMap {
  return Object.fromEntries(Object.entries(map).filter(([domain]) => !domains.includes(domain)))
}
