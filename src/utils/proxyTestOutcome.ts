import type { ProxyTestResult } from '@customTypes/proxy'

export type ProxyTestOutcome =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'finished'; result: ProxyTestResult }

const IDLE_TEXT = 'No test run yet'
const BUSY_TEXT = 'Testing…'

export function proxyTestOutcomeText (outcome: ProxyTestOutcome): string {
  if (outcome.state === 'idle') return IDLE_TEXT
  if (outcome.state === 'busy') return BUSY_TEXT
  return outcome.result.success ? `Connected through ${outcome.result.proxy}` : `Failed: ${outcome.result.error}`
}
