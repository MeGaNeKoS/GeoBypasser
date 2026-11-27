import { createServer } from 'node:http'
import { STORAGE_WAIT_MS, waitFor } from './smoke-fixture.mjs'

const ROUTED_URL = 'http://route-check.example/routed'
const DIRECT_URL = 'http://direct-check.example/direct'
const FETCH_TIMEOUT_MS = 5000

function routeConfig (port) {
  return {
    proxyList: [{ id: 'route-check', label: 'route check', type: 'http', proxyDNS: false, host: '127.0.0.1', port, notifyIfDown: false }],
    defaultProxy: null,
    fallbackDirect: false,
    rules: [{ active: true, name: 'route check', match: ['http://route-check.example/*'], proxyId: 'route-check' }],
    perWebsiteOverride: {}
  }
}

function startRecordingListener () {
  const requests = []
  const server = createServer((request, response) => {
    requests.push(request.url)
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('recorded')
  })
  return new Promise(done => server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port, requests })))
}

function fetchExpression (url) {
  return `fetch(${JSON.stringify(url)}, { signal: AbortSignal.timeout(${FETCH_TIMEOUT_MS}) }).then(r => r.status, e => String(e))`
}

export async function checkPacRoute ({ evalIn, worker, dashboard }, failures) {
  const { server, port, requests } = await startRecordingListener()
  try {
    await evalIn(worker, `chrome.storage.local.set(${JSON.stringify(routeConfig(port))}).then(() => true)`)
    await waitFor(
      () => evalIn(worker, 'chrome.proxy.settings.get({}).then(r => r.value?.pacScript?.data ?? "")')
        .then(pac => pac.includes(`127.0.0.1:${port}`)),
      STORAGE_WAIT_MS,
      'the PAC script to route through the recording listener',
    )
    await evalIn(dashboard, fetchExpression(ROUTED_URL))
    await evalIn(dashboard, fetchExpression(DIRECT_URL))
    if (!requests.includes(ROUTED_URL)) {
      failures.push(`PAC route: ${ROUTED_URL} did not reach the rule's proxy; the listener saw ${JSON.stringify(requests)}`)
    }
    if (requests.includes(DIRECT_URL)) {
      failures.push(`PAC route: ${DIRECT_URL} reached the rule's proxy but no rule names it`)
    }
    console.log(`PAC route observed: ${JSON.stringify(requests)}`)
  } finally {
    server.closeAllConnections()
    await new Promise(done => server.close(done))
  }
}
