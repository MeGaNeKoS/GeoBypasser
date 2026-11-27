import { runStep, sleep, STORAGE_WAIT_MS, TAB_SETTLE_MS, waitFor } from './smoke-fixture.mjs'
import { clickSelector } from './smoke-dashboard.mjs'

const PROTO_HOST = 'proto-check.example'
const PROTO_URL = `https://${PROTO_HOST}/constructor/__proto__/`
const ORDINARY_URL = `https://${PROTO_HOST}/alpha/beta/`

export const CHROME_NETWORK_SCENARIO = {
  requestUrls: [PROTO_URL],
  labels: ['__proto__', 'constructor', PROTO_HOST],
}

export const FIREFOX_NETWORK_SCENARIO = {
  requestUrls: [PROTO_URL, ORDINARY_URL],
  labels: [PROTO_HOST, 'alpha', 'beta'],
}

export async function recordNetworkRequest (url) {
  const api = globalThis.browser ?? globalThis.chrome
  const tab = await api.tabs.getCurrent()
  await api.runtime.sendMessage({ type: 'monitorTabNetwork', tabId: tab.id })
  await api.runtime.sendMessage({ type: 'devtoolsNetworkData', tabId: tab.id, url, sentSize: 3, receivedSize: 4 })
}

export function readNetworkTreeText () {
  return document.getElementById('networkTree').textContent
}

async function showRecordedRequests (run, { requestUrls, labels }) {
  for (const url of requestUrls) await run(recordNetworkRequest, [url])
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
  await runStep('network stats show recorded segment names as text', () => showRecordedRequests(run, scenario), failures)
}
