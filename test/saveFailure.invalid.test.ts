import { alertUnsavedChanges } from '@utils/saveFailure'

function fakeWindow () {
  let listener: ((event: { reason: unknown }) => void) | undefined
  return {
    target: { addEventListener: (_: string, fn: (event: any) => void) => { listener = fn } },
    fire: (reason: unknown) => listener?.({ reason }),
  }
}

describe('a rejection that is not a storage write failure is not shown as one', () => {
  it('does not show an ordinary error', () => {
    const { target, fire } = fakeWindow()
    const show = jest.fn()
    alertUnsavedChanges(target, show)

    fire(new Error('network down'))

    expect(show).not.toHaveBeenCalled()
  })
})
