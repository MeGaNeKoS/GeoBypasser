import type { ProxyTestResult } from '@customTypes/proxy'

export type ProxyTestOutcome =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'finished'; result: ProxyTestResult }

export type ProxyTestPanel =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'connected'; proxy: string }
  | { kind: 'failed'; reason: string }

const NO_RESPONSE_REASON = 'no response through this proxy.'
const TIMEOUT_ERROR_NAME = 'AbortError'

export function proxyTestPanelOf (outcome: ProxyTestOutcome): ProxyTestPanel {
  if (outcome.state === 'idle') return { kind: 'idle' }
  if (outcome.state === 'busy') return { kind: 'busy' }
  const { result } = outcome
  return result.success
    ? { kind: 'connected', proxy: result.proxy }
    : { kind: 'failed', reason: result.error }
}

export function testFailureReason (thrown: unknown): string {
  if (thrown instanceof Error && thrown.name === TIMEOUT_ERROR_NAME) return thrown.message
  return NO_RESPONSE_REASON
}
