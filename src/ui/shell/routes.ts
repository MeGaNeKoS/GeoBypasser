export const HOME_SECTION_ID = 'home'
export const PROXY_SECTION_ID = 'proxy'

const SECTION_HASHES: ReadonlyArray<readonly [sectionId: string, hash: string]> = [
  [HOME_SECTION_ID, 'home'],
  [PROXY_SECTION_ID, 'proxies'],
  ['rules', 'rules'],
  ['override', 'sites'],
  ['keepalive', 'keep-alive'],
  ['general', 'defaults'],
  ['diagnostics', 'test'],
  ['network', 'network'],
  ['impexp', 'import-export'],
  ['about', 'about'],
]

export function sectionIdForHash (hash: string): string {
  const name = hash.replace(/^#/, '')
  return SECTION_HASHES.find(([, sectionHash]) => sectionHash === name)?.[0] ?? HOME_SECTION_ID
}

export function hashForSection (sectionId: string): string {
  return SECTION_HASHES.find(([id]) => id === sectionId)?.[1] ?? HOME_SECTION_ID
}
