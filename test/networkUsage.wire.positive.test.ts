import { browser } from './setup'
import { registerFirefoxNetworkMonitor } from '@adapters/firefox'
import { createNetworkMonitor } from '@core/networkMonitor'
import { parseNetworkUsageReply } from '@schemas/networkUsage'
import { requestLogPages } from '@utils/requestLog'
import type { NetworkUsage, PathNode } from '@utils/networkUsage'

const TAB_ID = 3
const FIXTURE_HOST = '127.0.0.1'

function replyAfterRequests (urls: string[]): unknown {
  const monitor = createNetworkMonitor(() => undefined)
  monitor.answerNetworkMessage({ type: 'monitorTabNetwork', tabId: TAB_ID })
  registerFirefoxNetworkMonitor(monitor)
  urls.forEach((url, index) => {
    for (const listener of browser.webRequest.onCompleted._listeners) {
      listener({
        tabId: TAB_ID,
        requestId: `req-wire-${index}`,
        url,
        documentUrl: `http://${FIXTURE_HOST}:8080/page/`,
        type: 'xmlhttprequest',
        statusCode: 200,
        fromCache: false,
        requestSize: 100,
        responseSize: 200,
      })
    }
  })
  return monitor.answerNetworkMessage({ type: 'getNetworkStats' })
}

const replyAfterRequest = (url: string) => replyAfterRequests([url])

function pathTreeKeys (paths: Record<string, PathNode>, prefix = ''): string[] {
  return Object.entries(paths).flatMap(([name, node]) => [`${prefix}${name}`, ...pathTreeKeys(node.children, `${prefix}${name}/`)])
}

function pathKeysOf (usage: NetworkUsage): string[] {
  const page = requestLogPages(usage, []).find(p => p.page === FIXTURE_HOST)
  const host = page?.rows.find(row => row.host === FIXTURE_HOST)
  return pathTreeKeys(host?.paths ?? {})
}

describe('the usage tree keeps path segments named like Object properties across the message', () => {
  beforeEach(() => {
    for (const event of [browser.webRequest.onCompleted, browser.webRequest.onErrorOccurred]) {
      event._listeners.length = 0
    }
  })

  const url = `http://${FIXTURE_HOST}:8080/constructor/__proto__/`

  it('reaches the page when the reply is structured cloned (Firefox)', () => {
    const usage = parseNetworkUsageReply(structuredClone(replyAfterRequest(url)))
    expect(pathKeysOf(usage)).toEqual(['constructor', 'constructor/__proto__'])
  })

  it('reaches the page when the reply is JSON serialized (Chrome)', () => {
    const usage = parseNetworkUsageReply(JSON.parse(JSON.stringify(replyAfterRequest(url))))
    expect(pathKeysOf(usage)).toEqual(['constructor', 'constructor/__proto__'])
  })

  it('keeps the constructor node when the same host has earlier requests after a structured clone', () => {
    const reply = replyAfterRequests([
      `http://${FIXTURE_HOST}:8080/page/`,
      `http://${FIXTURE_HOST}:8080/alpha/beta/`,
      url,
    ])
    const usage = parseNetworkUsageReply(structuredClone(reply))
    expect(pathKeysOf(usage)).toEqual(['page', 'alpha', 'alpha/beta', 'constructor', 'constructor/__proto__'])
  })

  it('reaches the page from the in-memory reply with no clone', () => {
    const usage = parseNetworkUsageReply(replyAfterRequest(url))
    expect(pathKeysOf(usage)).toEqual(['constructor', 'constructor/__proto__'])
  })
})
