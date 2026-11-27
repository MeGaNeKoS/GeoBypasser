import { element, replaceContent } from '../dom'
import { button } from '../components/button'
import { banner } from '../components/feedback'
import { switchControl } from '../components/controls'
import { stateBody } from '../components/state-body'
import { usageTree } from '../components/tree'
import { networkTree } from '../sample-data'
import type { SectionContext } from './section-context'

const DEVTOOLS_NOTE = 'Keep DevTools open while monitoring.'
const CLEAR_FOCUS_KEY = 'clear-usage'

export function networkSection (context: SectionContext): HTMLElement {
  const { browser, listState } = context.store.get()
  return element('section', { class: 'stack' },
    element('header', { class: 'list-section__header' },
      element('div', { class: 'list-section__header-text' },
        element('h2', { class: 'page-title' }, 'Network'),
        element('p', { class: 'help' }, 'Requests this browser sent and received, grouped by domain.'),
      ),
    ),
    browser === 'chrome' ? banner({ tone: 'info', text: DEVTOOLS_NOTE }) : null,
    stateBody(listState, {
      emptyTitle: 'No traffic recorded yet.',
      emptyText: 'Turn on Monitor for a tab from the popup.',
      errorTitle: 'Could not read usage from the extension.',
    }, () => [usagePanel(context)]),
  )
}

function usagePanel (context: SectionContext): HTMLElement {
  const toolbar = element('div', { class: 'toolbar' })
  showToolbar(toolbar, context)
  return element('div', { class: 'stack' },
    toolbar,
    usageTree(networkTree),
  )
}

function showToolbar (toolbar: HTMLElement, context: SectionContext, focusKey?: string): void {
  replaceContent(toolbar, [
    button('Refresh', { onClick: () => context.refresh('Refreshed usage.') }),
    button('Clear', { focusKey: CLEAR_FOCUS_KEY, onClick: () => askClear(toolbar, context) }),
    element('label', { class: 'field__row' },
      element('span', { class: 'field__label' }, 'Auto refresh'),
      switchControl('Auto refresh', false, undefined, { field: 'autoRefresh' }),
    ),
  ], focusKey)
}

function askClear (toolbar: HTMLElement, context: SectionContext): void {
  replaceContent(toolbar, [
    element('div', { class: 'inline-confirm', role: 'group', 'aria-label': 'Confirm clear' },
      element('span', { class: 'inline-confirm__question' }, 'Clear all usage?'),
      button('Clear', { variant: 'danger', onClick: () => context.refresh('Cleared usage.') }),
      button('Cancel', { focusKey: CLEAR_FOCUS_KEY, onClick: () => showToolbar(toolbar, context, CLEAR_FOCUS_KEY) }),
    ),
  ], CLEAR_FOCUS_KEY)
}
