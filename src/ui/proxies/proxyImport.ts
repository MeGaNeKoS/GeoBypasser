import type { ProxyListItem } from '@customTypes/proxy'
import { parseImportJson, refuseProxyItems } from '@utils/importFiles'
import { keepStoredCredentials } from '@utils/proxyCredentials'
import { applyImportedProxy, duplicateIndexOf } from '@utils/proxyDraft'
import type { DuplicateChoice } from '@utils/proxyDraft'
import { askDuplicateChoice } from '../components/duplicate-sheet'
import type { SegmentOption } from '../components/controls'
import { readProxyList, saveProxyList } from './proxyStore'

const NOT_JSON_MESSAGE = 'Proxies were not imported: the file is not valid JSON.'
const DUPLICATE_OPTIONS: SegmentOption<DuplicateChoice>[] = [
  { value: 'replace', label: 'Replace the saved proxy' },
  { value: 'keepBoth', label: 'Keep both' },
  { value: 'skip', label: 'Skip this one' },
]

export async function importProxyFile (file: File): Promise<string[]> {
  const parsed = parseImportJson(await file.text())
  if (parsed === undefined) return [NOT_JSON_MESSAGE]
  const verdict = refuseProxyItems((parsed as { proxyList?: unknown } | null)?.proxyList)
  const stored = await readProxyList()
  const incoming = keepStoredCredentials(verdict.accepted, stored)
  let running = stored
  for (const proxy of incoming) {
    running = await applyOne(running, proxy)
  }
  await saveProxyList(running)
  return verdict.notes.map(note => note.text)
}

async function applyOne (list: ProxyListItem[], proxy: ProxyListItem): Promise<ProxyListItem[]> {
  const duplicateIndex = duplicateIndexOf(list, proxy)
  if (duplicateIndex === undefined) return applyImportedProxy(list, { proxy, copyId: crypto.randomUUID() })
  const choice = await askProxyDuplicateChoice(proxy)
  return applyImportedProxy(list, { proxy, duplicateIndex, choice, copyId: crypto.randomUUID() })
}

function askProxyDuplicateChoice (proxy: ProxyListItem): Promise<DuplicateChoice> {
  return askDuplicateChoice<DuplicateChoice>({
    title: 'Proxy already in the list',
    message: `${proxy.host}:${proxy.port} is already in the list.`,
    options: DUPLICATE_OPTIONS,
    skip: 'skip',
  })
}
