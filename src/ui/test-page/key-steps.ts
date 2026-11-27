const POLL_MS = 20

export function awaitKey (id: string, step: string): Promise<void> {
  const body = document.body
  body.dataset.awaitingKey = id
  body.dataset.awaitingStep = step
  return new Promise(done => {
    const poll = (): void => {
      if (body.dataset.keysDone !== id) {
        setTimeout(poll, POLL_MS)
        return
      }
      delete body.dataset.awaitingKey
      delete body.dataset.awaitingStep
      done()
    }
    poll()
  })
}
