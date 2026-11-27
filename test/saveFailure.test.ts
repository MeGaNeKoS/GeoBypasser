import { alertUnsavedChanges } from '@utils/saveFailure'
import { StorageWriteError } from '@utils/storage'

function fakeWindow () {
  let listener: ((event: { reason: unknown }) => void) | undefined
  return {
    target: { addEventListener: (_: string, fn: (event: any) => void) => { listener = fn } },
    fire: (reason: unknown) => listener?.({ reason }),
  }
}

describe('a storage write that fails is shown to the user', () => {
  it('shows the message of a storage write error', () => {
    const { target, fire } = fakeWindow()
    const show = jest.fn()
    alertUnsavedChanges(target, show)

    fire(new StorageWriteError('Your last change was not saved to local storage: quota exceeded'))

    expect(show).toHaveBeenCalledWith('Your last change was not saved to local storage: quota exceeded')
  })
})
