import { canSaveTestUrl } from '@utils/saveDecisions'
import { updateConfig } from '@utils/storage'
import { textField } from './fields'

const TEST_URL_LABEL = 'Test URL'
const TEST_URL_FAULT = 'Test URL must be an http or https address.'
const TEST_URL_FOCUS_KEY = 'test-url'

export type RerenderWithFocus = (focusKey?: string) => void

let invalidDraft: string | undefined

export function testUrlField (savedUrl: string, rerender: RerenderWithFocus): HTMLDivElement {
  return textField({
    name: 'testProxyUrl',
    label: TEST_URL_LABEL,
    type: 'url',
    value: invalidDraft ?? savedUrl,
    mono: true,
    fault: invalidDraft === undefined ? undefined : TEST_URL_FAULT,
    focusKey: TEST_URL_FOCUS_KEY,
    onChange: url => editTestUrl(url, rerender),
  })
}

function editTestUrl (url: string, rerender: RerenderWithFocus): void {
  if (canSaveTestUrl(url)) {
    invalidDraft = undefined
    void updateConfig({ testProxyUrl: url })
    return
  }
  invalidDraft = url
  rerender(TEST_URL_FOCUS_KEY)
}
