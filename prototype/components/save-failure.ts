import type { PrototypeState } from '../model'
import type { Store } from '../store'
import { button } from '@ui/components/button'
import { banner } from '@ui/components/feedback'

export const SAVE_FAILED_TEXT = 'Your changes were not saved. Try again.'

export function saveFailureBanner (store: Store<PrototypeState>): HTMLDivElement {
  return banner({
    tone: 'danger',
    text: SAVE_FAILED_TEXT,
    action: button('Dismiss', { onClick: () => store.update({ saveFailed: false }) }),
  })
}
