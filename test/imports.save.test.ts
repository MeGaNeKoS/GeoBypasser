import { STORAGE_KEYS } from '@constant/storageKeys'
import { importConfigText } from '@ui/import-export/configImport'
import { askImportReview } from '@ui/review/reviewSheet'
import { importRuleFile } from '@ui/rules/ruleImport'
import { importSiteFile } from '@ui/sites/siteImport'
import { browser } from './setup'

jest.mock('@ui/review/reviewSheet', () => ({
  askImportReview: jest.fn(async () => ({ duplicates: {}, settings: [] })),
}))

const askReview = askImportReview as unknown as jest.Mock

function loadStored (data: Record<string, unknown>) {
  browser.storage.local.get.mockImplementation(async (keys: any) => {
    if (typeof keys === 'string') return {}
    return Object.fromEntries((keys as string[]).filter(k => k in data).map(k => [k, data[k]]))
  })
}

function lastWrittenRules () {
  const calls = browser.storage.local.set.mock.calls as any[][]
  return calls[calls.length - 1][0][STORAGE_KEYS.rules]
}

function rulesFile (rules: unknown[]): File {
  return { text: async () => JSON.stringify({ rules }) } as unknown as File
}

function siteFile (perWebsiteOverride: Record<string, string>): File {
  return { text: async () => JSON.stringify({ perWebsiteOverride }) } as unknown as File
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('an import save', () => {
  it('leaves every stored rule it did not change exactly as it was, in order', async () => {
    const setAside = { active: false, name: 'Off', match: ['not a pattern'], proxyId: 'p1', futureField: 'kept' }
    const valid = { active: true, name: 'Valid', match: ['https://example.com/*'], proxyId: 'p1', futureField: { level: 2 } }
    loadStored({ [STORAGE_KEYS.rules]: [setAside, valid] })
    const imported = { active: true, name: 'New', match: ['https://example.net/*'], proxyId: 'p1' }

    await importRuleFile(rulesFile([imported]))

    expect(lastWrittenRules()).toEqual([setAside, valid, imported])
  })

  it('keeps a rule another tab added while the review was open', async () => {
    const existing = { active: true, name: 'Existing', match: ['https://a.example/*'], proxyId: 'p1' }
    const otherTab = { active: true, name: 'Other tab', match: ['https://b.example/*'], proxyId: 'p1' }
    const stored: Record<string, unknown> = { [STORAGE_KEYS.rules]: [existing] }
    loadStored(stored)
    askReview.mockImplementationOnce(async () => {
      stored[STORAGE_KEYS.rules] = [existing, otherTab]
      return { duplicates: {}, settings: [] }
    })
    const imported = { active: true, name: 'New', match: ['https://c.example/*'], proxyId: 'p1' }

    await importRuleFile(rulesFile([imported]))

    expect(lastWrittenRules()).toEqual([existing, otherTab, imported])
  })

  it('shows the review again instead of saving when another tab created a duplicate it decides on', async () => {
    const stored: Record<string, unknown> = { [STORAGE_KEYS.perWebsiteOverride]: {} }
    loadStored(stored)
    askReview.mockImplementationOnce(async () => {
      stored[STORAGE_KEYS.perWebsiteOverride] = { 'video.example.com': 'p2' }
      return { duplicates: {}, settings: [] }
    })
    askReview.mockImplementationOnce(async () => null)

    await importSiteFile(siteFile({ 'video.example.com': 'p1' }))

    expect(askReview).toHaveBeenCalledTimes(2)
    expect(browser.storage.local.set).not.toHaveBeenCalled()
  })

  it('keeps a site override another tab set while a config import was reviewed', async () => {
    const stored: Record<string, unknown> = { [STORAGE_KEYS.perWebsiteOverride]: {} }
    loadStored(stored)
    askReview.mockImplementationOnce(async () => {
      stored[STORAGE_KEYS.perWebsiteOverride] = { 'news.example': 'p3' }
      return { duplicates: {}, settings: [] }
    })
    const imported = { active: true, name: 'New', match: ['https://c.example/*'], proxyId: 'p1' }

    await importConfigText(JSON.stringify({ rules: [imported] }))

    const calls = browser.storage.local.set.mock.calls as any[][]
    expect(calls[calls.length - 1][0][STORAGE_KEYS.perWebsiteOverride]).toEqual({ 'news.example': 'p3' })
  })
})
