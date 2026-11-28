import { devtoolsPanelCopy, devtoolsPanelStateFor } from '@utils/devtoolsPanel'

describe('the devtools panel state follows the tab monitor reply', () => {
  it('shows the active state when the tab is monitored', () => {
    expect(devtoolsPanelStateFor(true)).toBe('active')
  })

  it('shows the inactive state when the tab is not monitored', () => {
    expect(devtoolsPanelStateFor(false)).toBe('inactive')
  })
})

describe('the devtools panel copy', () => {
  it('names the dashboard for the active state', () => {
    expect(devtoolsPanelCopy('active')).toBe('Network monitoring is on for this tab while DevTools is open. See usage in the dashboard under Network.')
  })

  it('names the popup Monitor control for the inactive state', () => {
    expect(devtoolsPanelCopy('inactive')).toBe('Network monitoring is off for this tab. Turn it on with Monitor in the popup.')
  })

  it('asks the reader to reopen DevTools for the error state', () => {
    expect(devtoolsPanelCopy('error')).toBe('Not connected to the extension. Close and reopen DevTools.')
  })

  it('shows the connecting line while the first reply is pending', () => {
    expect(devtoolsPanelCopy('loading')).toBe('Connecting to the extension…')
  })
})
