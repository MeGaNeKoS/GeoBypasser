import { runStep, serveImportFile, sleep, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { clickSelector } from './smoke-dashboard.mjs'

const FIXTURE_HOST = '127.0.0.1'

export const CHROME_NETWORK_SCENARIO = {
  paths: ['/constructor/__proto__/'],
  labels: [FIXTURE_HOST],
}

export const FIREFOX_NETWORK_SCENARIO = {
  paths: ['/constructor/__proto__/', '/alpha/beta/'],
  labels: [FIXTURE_HOST],
}

export async function recordNetworkRequest (url) {
  const api = globalThis.browser ?? globalThis.chrome
  const tab = await api.tabs.getCurrent()
  await api.runtime.sendMessage({ type: 'monitorTabNetwork', tabId: tab.id })
  await fetch(url, { mode: 'no-cors', cache: 'no-store' })
}

export function readNetworkTreeText () {
  return document.getElementById('networkContent').textContent
}

async function showRecordedRequests (run, origin, { paths, labels }) {
  for (const path of paths) await run(recordNetworkRequest, [`${origin}${path}`])
  await run(clickSelector, ['[data-tab="network"]'])
  await sleep(TAB_SETTLE_MS)
  await waitFor(
    async () => {
      const text = await run(readNetworkTreeText)
      return labels.every(label => text.includes(label))
    },
    STORAGE_WAIT_MS,
    `the Network section to show ${labels.join(', ')}`,
  )
}

export async function checkNetworkStatsNames (run, failures, scenario) {
  const fixture = await serveImportFile('{}')
  try {
    await runStep('network stats show recorded requests as text', () => showRecordedRequests(run, new URL(fixture.url).origin, scenario), failures)
  } finally {
    await fixture.close()
  }
}
