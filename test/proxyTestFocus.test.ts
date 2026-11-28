import { BLOCKED_REASON_FOCUS_KEY, testRenderFocus } from '../src/ui/proxy-test/testRenderFocus'

describe('focus across a Test render that blocks the test', () => {
  it('moves focus from a Test button that becomes disabled to the reason line', () => {
    expect(testRenderFocus({ focusedKey: 'test-saved', testable: false, returnKey: undefined }))
      .toEqual({ focusKey: BLOCKED_REASON_FOCUS_KEY, returnKey: 'test-saved' })
  })

  it('returns focus to the Test button when the test is enabled again from the reason line', () => {
    expect(testRenderFocus({ focusedKey: BLOCKED_REASON_FOCUS_KEY, testable: true, returnKey: 'test-custom' }))
      .toEqual({ focusKey: 'test-custom', returnKey: undefined })
  })
})
