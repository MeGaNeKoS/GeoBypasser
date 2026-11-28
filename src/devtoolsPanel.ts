import { requireElement } from '@ui/dom'
import { mountDevtoolsPanel } from '@ui/devtools/devtoolsPanelPage'

document.addEventListener('DOMContentLoaded', () => void mountDevtoolsPanel(requireElement('panelStatus')))
