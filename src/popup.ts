import { alertUnsavedChanges } from '@utils/saveFailure'
import { mountPopup } from '@ui/popup/popupPage'

alertUnsavedChanges(window, alert)

document.addEventListener('DOMContentLoaded', () => void mountPopup())
