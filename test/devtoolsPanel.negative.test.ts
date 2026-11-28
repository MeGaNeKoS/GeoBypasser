import { devtoolsPanelStateFor } from '@utils/devtoolsPanel'

describe('a missing or malformed monitor reply shows the error state', () => {
  it('treats an unanswered message as an error', () => {
    expect(devtoolsPanelStateFor(undefined)).toBe('error')
  })

  it('treats a null reply as an error', () => {
    expect(devtoolsPanelStateFor(null)).toBe('error')
  })

  it('does not read the string "true" as monitored', () => {
    expect(devtoolsPanelStateFor('true')).toBe('error')
  })

  it('does not read the number 1 as monitored', () => {
    expect(devtoolsPanelStateFor(1)).toBe('error')
  })
})
