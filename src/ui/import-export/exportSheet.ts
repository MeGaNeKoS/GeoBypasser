import { buildConfigExportFromChoices } from '@utils/exportFiles'
import type { ConfigExportChoices, ConfigExportSource } from '@utils/exportFiles'
import { keepAliveRows, overrideRows, proxyRows, ruleRows } from '@utils/pageView'
import { getConfig } from '@utils/storage'
import { button } from '../components/button'
import { switchControl } from '../components/controls'
import { switchField } from '../components/fields'
import { draftFlag, draftOf, draftValues, openSheet, setCheckedInputs } from '../components/sheet'
import type { Draft } from '../components/sheet'
import { element } from '../dom'
import { downloadJsonFile } from '../download'

type ExportGroupKey = keyof ConfigExportChoices

type ExportChoice = { value: string; label: string }

type ExportGroup = { key: ExportGroupKey; title: string; choices: ExportChoice[] }

const EXPORT_TITLE = 'Export configuration'
const EXPORT_LABEL = 'Export'
const EXPORT_FILE_NAME = 'config.json'
const LEAVE_OUT_CREDENTIALS_FIELD = 'leaveOutCredentials'
const LEAVE_OUT_CREDENTIALS_LABEL = 'Leave out usernames and passwords'
const LEAVE_OUT_CREDENTIALS_HELP = 'For a file you will share. Proxy usernames and passwords are not written.'
const SELECT_ENTIRE_CONFIG_LABEL = 'Select entire config'
const SELECT_GROUP_LABEL = 'Select all'
const EMPTY_GROUP_MESSAGE = 'Nothing to export in this group.'

export async function openExportSheet (): Promise<void> {
  const config = await getConfig()
  const groups = exportGroups(config)
  openSheet({
    title: EXPORT_TITLE,
    saveLabel: EXPORT_LABEL,
    draft: draftOf({ ...defaultChoices(groups), [LEAVE_OUT_CREDENTIALS_FIELD]: false }),
    render: draft => [
      button(SELECT_ENTIRE_CONFIG_LABEL, { onClick: event => setCheckedInputs(event, 'input[type="checkbox"]', true) }),
      ...groups.map(group => groupFieldset(group, draft)),
      leaveOutCredentialsField(draft),
    ],
    validate: () => [],
    save: draft => downloadJsonFile(EXPORT_FILE_NAME, JSON.stringify(exportFromDraft(config, draft), null, 2)),
  })
}

function exportGroups (config: ConfigExportSource): ExportGroup[] {
  return [
    {
      key: 'proxies',
      title: 'Proxies',
      choices: proxyRows(config.proxyList).map(({ index, label }) => ({ value: String(index), label })),
    },
    {
      key: 'rules',
      title: 'Rules',
      choices: ruleRows(config.rules, config.proxyList).map(({ index, name }) => ({ value: String(index), label: name })),
    },
    {
      key: 'overrides',
      title: 'Overrides',
      choices: overrideRows(config.perWebsiteOverride, config.proxyList).map(({ domain }) => ({ value: domain, label: domain })),
    },
    {
      key: 'keepAlive',
      title: 'Keep-alive',
      choices: keepAliveRows(config.keepAliveRules, config.proxyList).map(({ proxyId, proxyLabel }) => ({ value: proxyId, label: proxyLabel })),
    },
  ]
}

function defaultChoices (groups: ExportGroup[]): Record<ExportGroupKey, string[]> {
  return {
    proxies: choiceValues(groups, 'proxies'),
    rules: choiceValues(groups, 'rules'),
    overrides: choiceValues(groups, 'overrides'),
    keepAlive: choiceValues(groups, 'keepAlive'),
  }
}

function choiceValues (groups: ExportGroup[], key: ExportGroupKey): string[] {
  return groups.find(group => group.key === key)?.choices.map(choice => choice.value) ?? []
}

function groupFieldset (group: ExportGroup, draft: Draft): HTMLFieldSetElement {
  const legend = element('legend', {}, group.title)
  if (group.choices.length === 0) {
    return element('fieldset', { class: 'export-group' }, legend, element('p', { class: 'help' }, EMPTY_GROUP_MESSAGE))
  }
  const selected = draftValues(draft, group.key)
  return element('fieldset', { class: 'export-group' },
    legend,
    button(SELECT_GROUP_LABEL, { onClick: event => setCheckedInputs(event, `input[name="${group.key}"]`, true) }),
    ...group.choices.map(choice => choiceCheckbox(group.key, choice, selected.includes(choice.value))),
  )
}

function choiceCheckbox (name: ExportGroupKey, choice: ExportChoice, checked: boolean): HTMLLabelElement {
  return element('label', { class: 'checkbox' },
    element('input', { type: 'checkbox', name, value: choice.value, checked }),
    choice.label,
  )
}

function leaveOutCredentialsField (draft: Draft): HTMLDivElement {
  return switchField({
    label: LEAVE_OUT_CREDENTIALS_LABEL,
    control: switchControl(LEAVE_OUT_CREDENTIALS_LABEL, draftFlag(draft, LEAVE_OUT_CREDENTIALS_FIELD), undefined, { field: LEAVE_OUT_CREDENTIALS_FIELD }),
    help: LEAVE_OUT_CREDENTIALS_HELP,
  })
}

function exportFromDraft (config: ConfigExportSource, draft: Draft) {
  const choices: ConfigExportChoices = {
    proxies: draftValues(draft, 'proxies'),
    rules: draftValues(draft, 'rules'),
    overrides: draftValues(draft, 'overrides'),
    keepAlive: draftValues(draft, 'keepAlive'),
  }
  const credentials = draftFlag(draft, LEAVE_OUT_CREDENTIALS_FIELD) ? 'omit' : 'include'
  return buildConfigExportFromChoices(config, choices, credentials)
}
