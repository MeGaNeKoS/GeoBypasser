export type DevtoolsPanelState = 'loading' | 'active' | 'inactive' | 'error'

export function devtoolsPanelStateFor (monitorReply: unknown): DevtoolsPanelState {
  if (monitorReply === true) return 'active'
  if (monitorReply === false) return 'inactive'
  return 'error'
}

const PANEL_COPY: Record<DevtoolsPanelState, string> = {
  loading: 'Connecting to the extension…',
  active: 'Network monitoring is on for this tab while DevTools is open. See usage in the dashboard under Network.',
  inactive: 'Network monitoring is off for this tab. Turn it on with Monitor in the popup.',
  error: 'Not connected to the extension. Close and reopen DevTools.',
}

export function devtoolsPanelCopy (state: DevtoolsPanelState): string {
  return PANEL_COPY[state]
}
