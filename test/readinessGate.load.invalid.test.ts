import { createReadinessGate } from '@core/readinessGate'

describe('readiness gate when the load fails', () => {
  it('rejects a use registered before the failure and keeps no current value', async () => {
    const gate = createReadinessGate(() => Promise.reject(new Error('storage is unavailable')))

    const answer = gate.whenReady(() => 'never')

    await expect(answer).rejects.toThrow('storage is unavailable')
    expect(gate.current()).toBeUndefined()
  })
})
