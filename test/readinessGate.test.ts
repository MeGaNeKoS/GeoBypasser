import { createReadinessGate } from '@core/readinessGate'

describe('readiness gate', () => {
  it('runs a use registered before the load finishes once the load resolves', async () => {
    let finishLoad!: (value: string) => void
    const gate = createReadinessGate(() => new Promise<string>(done => { finishLoad = done }))

    const answer = gate.whenReady(value => `answered with ${value}`)
    expect(gate.current()).toBeUndefined()

    finishLoad('stored')
    await expect(answer).resolves.toBe('answered with stored')
    expect(gate.current()).toBe('stored')
  })
})
