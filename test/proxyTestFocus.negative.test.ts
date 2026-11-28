import { testRenderFocus } from '../src/ui/proxy-test/testRenderFocus'

describe('focus across a Test render when focus is elsewhere', () => {
  it('keeps focus where the user moved it when the test is enabled again', () => {
    expect(testRenderFocus({ focusedKey: 'test-url', testable: true, returnKey: 'test-custom' }))
      .toEqual({ focusKey: 'test-url', returnKey: undefined })
  })

  it('leaves focus on a field when the test is blocked', () => {
    expect(testRenderFocus({ focusedKey: 'test-url', testable: false, returnKey: undefined }))
      .toEqual({ focusKey: 'test-url', returnKey: undefined })
  })

  it('does not return focus to the reason line when nothing was moved from a button', () => {
    expect(testRenderFocus({ focusedKey: undefined, testable: true, returnKey: undefined }))
      .toEqual({ focusKey: undefined, returnKey: undefined })
  })
})
