import { mountDashboardFrame } from '@ui/shell/frame'
import { alertUnsavedChanges } from '@utils/saveFailure'

alertUnsavedChanges(window, alert)

document.addEventListener('DOMContentLoaded', () => {
  mountDashboardFrame()
})
