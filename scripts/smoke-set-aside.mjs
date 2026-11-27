import { runStep } from './smoke-fixture.mjs'
import { captureDownload, checkEveryConfigExportItem, clickSelector } from './smoke-dashboard.mjs'

const SET_ASIDE_EXPORT_INDEXES = [1, 2, 3]
const SET_ASIDE_SKIPPED_INDEXES = [1, 2]

function parseExport (label, text, failures) {
  if (text === null) {
    failures.push(`${label} wrote no file`)
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    failures.push(`${label} wrote text that is not JSON`)
    return null
  }
}

async function checkRowExportsSetAside (run, failures) {
  for (const index of SET_ASIDE_EXPORT_INDEXES) {
    const text = await run(captureDownload, [`#ruleTable button[data-export="${index}"]`])
    const parsed = parseExport(`Export on set aside rule row ${index}`, text, failures)
    if (parsed && !Array.isArray(parsed.rules)) failures.push(`Export on set aside rule row ${index} lacks a rule list`)
    if (parsed && SET_ASIDE_SKIPPED_INDEXES.includes(index) && parsed.rules?.length !== 0) {
      failures.push(`Export on set aside rule row ${index} did not write an empty rule list`)
    }
  }
}

async function checkConfigExportEveryRow (run, failures) {
  await run(clickSelector, ['#openExportConfig'])
  await run(checkEveryConfigExportItem)
  const text = await run(captureDownload, ['#exportConfigConfirm'])
  const parsed = parseExport('config export with every row selected', text, failures)
  if (!parsed) return
  if (!Array.isArray(parsed.rules) || !Array.isArray(parsed.proxyList)) {
    failures.push('config export with every row selected lacks a rule or proxy list')
  } else if (parsed.rules.some(rule => typeof rule !== 'object' || rule === null)) {
    failures.push('config export with every row selected wrote a rule that is not an object')
  }
}

export async function checkSetAsideExports (run, failures) {
  const failuresBefore = failures.length
  await runStep('set aside row export', () => checkRowExportsSetAside(run, failures), failures)
  await runStep('config export with every row', () => checkConfigExportEveryRow(run, failures), failures)
  if (failures.length === failuresBefore) {
    console.log('set aside: the row Export writes a rule list and skips non-object rows, and a config export with every row selected writes only object rules')
  }
}
