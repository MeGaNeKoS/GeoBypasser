export const HOME_SECTION_ID = 'home'
export const PROXY_SECTION_ID = 'proxy'
export const RULES_SECTION_ID = 'rules'
export const SITE_SECTION_ID = 'override'
export const KEEP_ALIVE_SECTION_ID = 'keepalive'
export const GENERAL_SECTION_ID = 'general'
export const TEST_SECTION_ID = 'diagnostics'
export const NETWORK_SECTION_ID = 'network'
export const ABOUT_SECTION_ID = 'about'

const SECTION_HASHES: ReadonlyArray<readonly [sectionId: string, hash: string]> = [
  [HOME_SECTION_ID, 'home'],
  [PROXY_SECTION_ID, 'proxies'],
  [RULES_SECTION_ID, 'rules'],
  [SITE_SECTION_ID, 'sites'],
  [KEEP_ALIVE_SECTION_ID, 'keep-alive'],
  [GENERAL_SECTION_ID, 'defaults'],
  [TEST_SECTION_ID, 'test'],
  [NETWORK_SECTION_ID, 'network'],
  ['impexp', 'import-export'],
  [ABOUT_SECTION_ID, 'about'],
]

export const SET_ASIDE_ONLY_QUERY = 'set-aside'

const SET_ASIDE_SECTION_IDS: readonly string[] = [PROXY_SECTION_ID, RULES_SECTION_ID, SITE_SECTION_ID, KEEP_ALIVE_SECTION_ID]

export function sectionIdForHash (hash: string): string {
  const name = pathOf(hash)
  return SECTION_HASHES.find(([, sectionHash]) => sectionHash === name)?.[0] ?? HOME_SECTION_ID
}

export function hashForSection (sectionId: string): string {
  return SECTION_HASHES.find(([id]) => id === sectionId)?.[1] ?? HOME_SECTION_ID
}

export function isSetAsideOnlyHash (hash: string): boolean {
  return new URLSearchParams(queryOf(hash)).has(SET_ASIDE_ONLY_QUERY)
}

export function setAsideOnlyHashFor (sectionHash: string): string {
  const sectionId = sectionIdForHash(sectionHash)
  return SET_ASIDE_SECTION_IDS.includes(sectionId) ? `#${sectionHash}?${SET_ASIDE_ONLY_QUERY}` : `#${sectionHash}`
}

function pathOf (hash: string): string {
  return hash.replace(/^#/, '').split('?')[0]
}

function queryOf (hash: string): string {
  return hash.split('?')[1] ?? ''
}
