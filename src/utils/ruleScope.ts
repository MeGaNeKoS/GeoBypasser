import { getHostname, isHostOrSubdomain } from '@utils/generic'
import { MAIN_FRAME_RESOURCE_TYPE } from '@utils/networkUsage'

export type ScopedRequest = {
  type: string
  url?: string
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

function pageHostnameOf (request: ScopedRequest): string | null {
  const pageUrl = pageUrlOf(request)
  if (request.tabId === NO_TAB_ID || pageUrl === undefined) return null
  return getHostname(pageUrl)
}

function pageUrlOf ({ type, url, documentUrl }: ScopedRequest): string | undefined {
  return type === MAIN_FRAME_RESOURCE_TYPE ? url : documentUrl
}

function domainOf (entry: string): string {
  const normalized = entry.trim().toLowerCase()
  return normalized.startsWith(WILDCARD_PREFIX) ? normalized.slice(WILDCARD_PREFIX.length) : normalized
}
