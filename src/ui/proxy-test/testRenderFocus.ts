export const BLOCKED_REASON_FOCUS_KEY = 'test-blocked-reason'

const TEST_BUTTON_KEYS: readonly string[] = ['test-saved', 'test-custom']

export type TestRenderFocus = {
  focusKey: string | undefined
  returnKey: string | undefined
}

export type TestRenderFocusInput = {
  focusedKey: string | undefined
  testable: boolean
  returnKey: string | undefined
}

export function testRenderFocus ({ focusedKey, testable, returnKey }: TestRenderFocusInput): TestRenderFocus {
  if (!testable && focusedKey !== undefined && TEST_BUTTON_KEYS.includes(focusedKey)) {
    return { focusKey: BLOCKED_REASON_FOCUS_KEY, returnKey: focusedKey }
  }
  if (testable && focusedKey === BLOCKED_REASON_FOCUS_KEY) {
    return { focusKey: returnKey, returnKey: undefined }
  }
  if (!testable && focusedKey === BLOCKED_REASON_FOCUS_KEY) {
    return { focusKey: BLOCKED_REASON_FOCUS_KEY, returnKey }
  }
  return { focusKey: focusedKey, returnKey: undefined }
}
