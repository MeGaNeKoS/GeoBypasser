import { element } from '@ui/dom'
import { button } from '@ui/components/button'
import { draftFlag, draftOf, draftValues, openSheet, setCheckedInputs, type Draft, type Fault } from '@ui/components/sheet'
import { proxyAddress, routeLabel } from '../proxy-lookup'
import type { ListState } from '../model'
import type { SectionContext } from '../pages/section-context'
import { keepAliveRules, proxies, rules, sites } from '../sample-data'

const NOTHING_TO_EXPORT = 'Nothing to export yet.'

type ExportEntry = {
  key: string;
  label: string;
}

type ExportGroup = {
  key: string;
  title: string;
  entries: ExportEntry[];
}

export function openExportSheet (context: SectionContext): void {
  const groups = exportGroups(context.store.get().listState)
  const hasItems = groups.some(group => group.entries.length > 0)
  openSheet({
    title: 'Export settings',
    saveLabel: 'Export',
    saveDisabled: !hasItems,
    draft: draftOf({ items: groups.flatMap(group => group.entries.map(entry => entry.key)), leaveOut: false }),
    render: () => hasItems ? exportBody(groups) : [element('p', {}, NOTHING_TO_EXPORT)],
    validate: draft => exportFaults(draft),
    save: draft => context.refresh(exportSummary(draftValues(draft, 'items').length, draftFlag(draft, 'leaveOut'))),
  })
}

function exportGroups (listState: ListState): ExportGroup[] {
  if (listState === 'empty') return []
  return [
    { key: 'proxies', title: 'Proxies', entries: proxies.map(proxy => ({ key: `proxies:${proxy.id}`, label: proxy.label || proxyAddress(proxy) })) },
    { key: 'rules', title: 'Rules', entries: rules.map(rule => ({ key: `rules:${rule.id}`, label: rule.name || '(no name)' })) },
    { key: 'sites', title: 'Sites', entries: sites.map(site => ({ key: `sites:${site.id}`, label: site.domain })) },
    { key: 'keep-alive', title: 'Keep-alive', entries: keepAliveRules.map(rule => ({ key: `keep-alive:${rule.id}`, label: routeLabel(rule.proxyId) })) },
  ]
}

function exportBody (groups: ExportGroup[]): Node[] {
  return [
    element('div', { class: 'button-row' },
      button('Select entire config', { onClick: event => setCheckedInputs(event, 'input[name="items"]', true) }),
    ),
    ...groups.map(group => exportGroup(group)),
    element('label', { class: 'checkbox' },
      element('input', { type: 'checkbox', name: 'leaveOut', value: 'true' }),
      'Leave out usernames and passwords',
    ),
  ]
}

function exportGroup (group: ExportGroup): HTMLElement {
  const groupSelector = `input[name="items"][data-group="${group.key}"]`
  return element('section', { class: 'review-group' },
    element('div', { class: 'button-row' },
      element('h3', { class: 'group-label' }, group.title),
      button('Select all', { onClick: event => setCheckedInputs(event, groupSelector, true) }),
    ),
    ...group.entries.map(entry => element('label', { class: 'checkbox' },
      element('input', { type: 'checkbox', name: 'items', value: entry.key, 'data-group': group.key, checked: true }),
      entry.label,
    )),
  )
}

function exportFaults (draft: Draft): Fault[] {
  return draftValues(draft, 'items').length === 0 ? [{ field: 'items', message: 'Choose at least one item to export.' }] : []
}

function exportSummary (count: number, leaveOut: boolean): string {
  const plural = count === 1 ? 'item' : 'items'
  const credentialsNote = leaveOut ? 'Usernames and passwords are left out.' : 'Usernames and passwords are included.'
  return `Exported ${count} ${plural}. ${credentialsNote}`
}
