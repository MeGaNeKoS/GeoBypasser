import { jest } from '@jest/globals'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { ProxyListItem } from '@customTypes/proxy'
import { STORAGE_KEYS } from '@constant/storageKeys'
import { testProxyConfigQueued } from '@utils/proxy'
import {
  authChallengeListener,
  BackgroundName,
  settle,
  startBackground,
  storageChangeListeners,
  storeLocally,
} from './backgroundHarness'

const PASSWORD_MARKER = 'marker-password-4c1d'
const USERNAME_MARKER = 'marker-username-4c1d'
const TEST_URL = 'https://example.com/'

const proxy: ProxyListItem = {
  id: 'p1',
  type: 'http',
  host: 'proxy.lan',
  port: 8080,
  proxyDNS: false,
  username: USERNAME_MARKER,
  password: PASSWORD_MARKER,
}
const stored = {
  [STORAGE_KEYS.proxyList]: [proxy],
  [STORAGE_KEYS.defaultProxy]: 'p1',
  [STORAGE_KEYS.rules]: [{ active: true, name: 'r', match: [TEST_URL], proxyId: 'p1' }],
}

let logged: string[] = []

function render (arg: unknown) {
  try {
    return JSON.stringify(arg) ?? String(arg)
  } catch {
    return String(arg)
  }
}

function captureConsole () {
  for (const level of ['log', 'info', 'debug', 'warn', 'error', 'dir'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(render).join(' '))
    })
  }
}

async function exerciseBackground (name: BackgroundName) {
  await startBackground(name)

  const changes = {
    [STORAGE_KEYS.proxyList]: { oldValue: [], newValue: [proxy] },
    [STORAGE_KEYS.rules]: { oldValue: [], newValue: stored[STORAGE_KEYS.rules] },
  }
  await Promise.all(storageChangeListeners().map(listener => listener(changes, 'local')))
  await settle()

  const listener = authChallengeListener(name)
  await listener({ isProxy: true, url: TEST_URL, challenger: { host: 'proxy.lan', port: 8080 } })
  await listener({ isProxy: false, url: TEST_URL, challenger: { host: 'proxy.lan', port: 8080 } })

  await testProxyConfigQueued(proxy, TEST_URL, () => {})
  await settle()
}

describe.each(['firefox', 'chrome'] as BackgroundName[])('%s background console output', name => {
  beforeEach(() => {
    logged = []
    captureConsole()
    storeLocally(stored)
    global.fetch = jest.fn(async () => ({ ok: true, status: 200 })) as any
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('never prints the proxy password or username', async () => {
    await exerciseBackground(name)

    expect(logged.length).toBeGreaterThan(0)
    const output = logged.join('\n')
    expect(output).not.toContain(PASSWORD_MARKER)
    expect(output).not.toContain(USERNAME_MARKER)
  })
})

const SOURCE_ROOT = resolve(__dirname, '..', 'src')
const CREDENTIAL_SOURCE_NAME = /proxy|config|change|setting|cfg|rule|override/i
const STRING_LITERAL = /`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g
const BARE_IDENTIFIER = /(?<![\w$.])[A-Za-z_$][\w$]*/g

function sourceFiles (dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith('.ts') ? [path] : []
  })
}

function consoleCallArguments (source: string): string[] {
  return Array.from(source.matchAll(/console\.\w+\(/g), match => {
    const start = match.index! + match[0].length
    let depth = 1
    let end = start
    while (depth > 0 && end < source.length) {
      if (source[end] === '(') depth++
      if (source[end] === ')') depth--
      end++
    }
    return source.slice(start, end - 1)
  })
}

function credentialSourceNames (args: string): string[] {
  const withoutLiterals = args.replace(STRING_LITERAL, '""')
  return (withoutLiterals.match(BARE_IDENTIFIER) ?? []).filter(name => CREDENTIAL_SOURCE_NAME.test(name))
}

describe('console calls in src', () => {
  it('pass no proxy, proxy list, config, or storage change object', () => {
    const offending = sourceFiles(SOURCE_ROOT).flatMap(file =>
      consoleCallArguments(readFileSync(file, 'utf8'))
        .filter(args => credentialSourceNames(args).length > 0)
        .map(args => `${relative(SOURCE_ROOT, file)}: console(${args.trim()})`),
    )

    expect(offending).toEqual([])
  })
})
