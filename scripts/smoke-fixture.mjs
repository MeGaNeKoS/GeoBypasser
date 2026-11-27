import { createServer } from 'node:http'

export const sleep = ms => new Promise(done => setTimeout(done, ms))

export async function waitFor (fn, ms, what) {
  const end = Date.now() + ms
  for (;;) {
    const value = await Promise.resolve().then(fn).catch(() => undefined)
    if (value) return value
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`)
    await sleep(100)
  }
}

export const canon = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]))
  : v)

export const CREDENTIAL_PROXY = {
  id: 'proxy-creds',
  type: 'http',
  proxyDNS: false,
  host: 'creds.lan',
  port: 3128,
  username: 'smoke-user',
  password: 'smoke-pass'
}

export const FIXTURE = {
  proxyList: [
    { id: 'proxy-good', label: 'good', type: 'http', proxyDNS: false, host: ' good.lan ', port: 8080, notifyIfDown: false },
    { id: 'proxy-broken', label: 'broken', type: 'http', proxyDNS: false, host: '', port: 0 },
    null,
    'set aside text',
    {},
    CREDENTIAL_PROXY
  ],
  defaultProxy: 'proxy-good',
  fallbackDirect: false,
  testProxyUrl: 'not a url',
  rules: [
    { active: true, name: 'good rule', match: ['*://good.example/*'], proxyId: 'proxy-good' },
    { active: true, name: 'broken rule', match: ['not a pattern'], proxyId: 'proxy-good' },
    null,
    'set aside text',
    {}
  ],
  keepAliveRules: {
    'proxy-good': { active: true, tabUrls: ['good.example'] },
    'proxy-broken': { active: 'yes', tabUrls: [] }
  },
  perWebsiteOverride: {
    'good.example': 'proxy-good',
    'bad domain': 'proxy-good',
    'object.example': {},
    'null.example': null
  }
}

export const SET_ASIDE_RULE = 1
export const SET_ASIDE_PROXY = 1

export const URL_IMPORT_FILE = {
  rules: [
    { active: true, name: 'url valid rule', match: ['*://url.example/*'], proxyId: 'proxy-good' },
    { active: true, name: 'url refused rule', match: ['not a pattern'], proxyId: 'proxy-good' }
  ]
}

export async function serveImportFile (body) {
  const server = createServer((_, res) => {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
    res.end(body)
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return {
    url: `http://127.0.0.1:${server.address().port}/import.json`,
    close: () => new Promise(done => server.close(done)),
  }
}
