import { readFileSync, readdirSync } from 'fs'
import { join, relative } from 'path'

const ROOT = join(__dirname, '..')
const SOURCE_DIRECTORY = join(ROOT, 'src')
const DASHBOARD_MARKUP = join(ROOT, 'assets', 'dashboard.html')
const SCANNED_EXTENSION = /\.(ts|html)$/
const CLOUD_MODE_TERMS = ['storage.sync', 'storageMode', 'STORAGE_MODE', 'StorageMode', 'getUserStorageMode']

function scannedFiles (): string[] {
  const sourceFiles = readdirSync(SOURCE_DIRECTORY, { recursive: true }).map(name => join(SOURCE_DIRECTORY, String(name)))
  return [...sourceFiles, DASHBOARD_MARKUP].filter(file => SCANNED_EXTENSION.test(file))
}

describe('source without the cloud storage mode', () => {
  it.each(CLOUD_MODE_TERMS)('has no reference to %s', term => {
    const offenders = scannedFiles()
      .filter(file => readFileSync(file, 'utf8').includes(term))
      .map(file => relative(ROOT, file))
    expect(offenders).toEqual([])
  })
})
