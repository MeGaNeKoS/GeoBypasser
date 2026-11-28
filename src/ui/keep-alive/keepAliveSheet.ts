import { switchControl } from '../components/controls'
import { switchField, textField } from '../components/fields'
import { patternList } from '../components/pattern-list'
import { proxySelectField } from '../components/proxy-select'
import { draftFlag, draftOf, draftValue, draftValues, faultFor, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { keepAliveFormFaults, keepAliveFormOf, keepAliveMapAfterSave, keepAliveStoredFaults } from '@utils/keepAliveDraft'
import type { KeepAliveForm } from '@utils/keepAliveDraft'
import { faultRowsOf } from '@utils/ruleFaults'
import { getConfig } from '@utils/storage'
import { readProxyList } from '../proxies/proxyStore'
import { changeKeepAliveMap } from './keepAliveStore'

export type KeepAliveEditorOptions = {
  entry?: { proxyId: string; rule: unknown; needsReview?: boolean };
  onSaved?: () => void;
}

const PATTERN_PLACEHOLDER = 'example.com'
const PATTERN_HELP = 'Hostname such as example.com or *.example.com'
const TEST_URL_HELP = 'Leave empty to use the test URL from Defaults.'

export async function openKeepAliveEditor (options: KeepAliveEditorOptions): Promise<void> {
  const [proxyList, { testProxyUrl: defaultTestUrl }] = await Promise.all([readProxyList(), getConfig()])
  const form = keepAliveFormOf(options.entry?.proxyId ?? '', options.entry?.rule)
  openSheet({
    title: options.entry ? 'Edit keep-alive rule' : 'Add keep-alive rule',
    saveLabel: 'Save',
    draft: draftOf({ proxyId: form.proxyId, active: form.active, tabUrls: form.tabUrls, testProxyUrl: form.testProxyUrl }),
    initialFaults: options.entry?.needsReview ? keepAliveStoredFaults(form.proxyId, options.entry.rule) : undefined,
    render: (draft, faults) => renderFields(formFromDraft(draft), proxyList, defaultTestUrl, faults),
    validate: draft => keepAliveFormFaults(formFromDraft(draft)),
    save: draft => void saveKeepAlive(formFromDraft(draft), options),
  })
}

async function saveKeepAlive (form: KeepAliveForm, options: KeepAliveEditorOptions): Promise<void> {
  await changeKeepAliveMap(map => keepAliveMapAfterSave(map, form, options.entry?.proxyId))
  options.onSaved?.()
}

function formFromDraft (draft: Draft): KeepAliveForm {
  return {
    proxyId: draftValue(draft, 'proxyId'),
    active: draftFlag(draft, 'active'),
    tabUrls: draftValues(draft, 'tabUrls'),
    testProxyUrl: draftValue(draft, 'testProxyUrl'),
  }
}

function renderFields (form: KeepAliveForm, proxyList: unknown, defaultTestUrl: string, faults: Fault[]): Node[] {
  return [
    proxySelectField({ name: 'proxyId', label: 'Proxy', proxyList, proxyId: form.proxyId, fault: faultFor(faults, 'proxyId') }),
    switchField({
      label: 'Active',
      control: switchControl('Active', form.active, undefined, { field: 'active' }),
      help: faultFor(faults, 'active'),
    }),
    patternList({
      field: 'tabUrls',
      label: 'Tab URL patterns',
      patterns: form.tabUrls,
      faults: faultRowsOf(faults, 'tabUrls'),
      placeholder: PATTERN_PLACEHOLDER,
      help: faultFor(faults, 'tabUrls') ?? PATTERN_HELP,
      addLabel: 'Add pattern',
    }),
    textField({
      name: 'testProxyUrl',
      label: 'Test URL',
      value: form.testProxyUrl,
      type: 'url',
      mono: true,
      placeholder: defaultTestUrl,
      help: TEST_URL_HELP,
      fault: faultFor(faults, 'testProxyUrl'),
    }),
  ]
}
