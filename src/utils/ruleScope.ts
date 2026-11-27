import { getHostname, isHostOrSubdomain } from '@utils/generic'

export type ScopedRequest = {
  type: string
  tabId: number
  documentUrl?: string
}

export type ScopeLimits = {
  proxyOnlyResourceTypes?: string[]
  proxyOnlyPageHostnames?: string[]
}

const NO_TAB_ID = -1
const WILDCARD_PREFIX = '*.'

export function isInRuleScope (request: ScopedRequest, limits: ScopeLimits): boolean {
  return isListedResourceType(request.type, limits.proxyOnlyResourceTypes) &&
    isOnListedPage(request, limits.proxyOnlyPageHostnames)
}

function isListedResourceType (type: string, listedTypes: string[] | undefined): boolean {
  return !listedTypes?.length || listedTypes.includes(type)
}

function isOnListedPage (request: ScopedRequest, listedHostnames: string[] | undefined): boolean {
  if (!listedHostnames?.length) return true
  const pageHostname = pageHostnameOf(request)
  return pageHostname !== null && listedHostnames.some(entry => isHostOrSubdomain(pageHostname, domainOf(entry)))
}

function pageHostnameOf ({ tabId, documentUrl }: ScopedRequest): string | null {
  if (tabId === NO_TAB_ID || documentUrl === undefined) return null
  return getHostname(documentUrl)
}

function domainOf (entry: string): string {
  const normalized = entry.trim().toLowerCase()
  return normalized.startsWith(WILDCARD_PREFIX) ? normalized.slice(WILDCARD_PREFIX.length) : normalized
}
