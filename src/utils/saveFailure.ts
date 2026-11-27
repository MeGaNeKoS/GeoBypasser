import { StorageWriteError } from '@utils/storage'

interface UnhandledRejectionTarget {
  addEventListener: (type: 'unhandledrejection', listener: (event: PromiseRejectionEvent) => void) => void
}

export function alertUnsavedChanges (target: UnhandledRejectionTarget, show: (message: string) => void): void {
  target.addEventListener('unhandledrejection', event => {
    if (event.reason instanceof StorageWriteError) show(event.reason.message)
  })
}
