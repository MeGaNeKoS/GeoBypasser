import { createUsageChangeBroadcast, USAGE_BROADCAST_INTERVAL_MS } from '@core/usageChangeBroadcast'

describe('a burst of usage changes is sent once after the interval', () => {
  it('sends once for several changes inside one interval', () => {
    const send = jest.fn()
    const pending: Array<{ run: () => void; afterMs: number }> = []
    const notify = createUsageChangeBroadcast(send, (run, afterMs) => pending.push({ run, afterMs }))

    notify()
    notify()
    notify()

    expect(pending).toHaveLength(1)
    expect(pending[0].afterMs).toBe(USAGE_BROADCAST_INTERVAL_MS)
    expect(send).not.toHaveBeenCalled()

    pending[0].run()

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('schedules a new send for a change after the previous send ran', () => {
    const send = jest.fn()
    const pending: Array<() => void> = []
    const notify = createUsageChangeBroadcast(send, run => pending.push(run))

    notify()
    pending.shift()?.()
    notify()
    pending.shift()?.()

    expect(send).toHaveBeenCalledTimes(2)
  })
})
