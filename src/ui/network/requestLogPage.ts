import { formatProxiedShare, type RequestLogPage } from '@utils/requestLog'
import { button } from '../components/button'
import { element } from '../dom'
import { requestLogTable, type LogRowActions } from './requestLogTable'

const CREATE_RULE_LABEL = 'Create rule from selection'
const THROUGH_PROXIES_PREFIX = 'Through proxies: '

export type PageGroupOptions = {
  rowActions: LogRowActions;
  canCreateRule: boolean;
  onCreateRule: (page: string) => void;
};

export function requestLogPageGroup (page: RequestLogPage, options: PageGroupOptions): HTMLElement {
  return element('section', { class: 'log-page', 'aria-label': page.page },
    element('div', { class: 'log-page__head' },
      element('h3', { class: 'mono' }, page.page),
      element('span', { class: 'muted' }, `${THROUGH_PROXIES_PREFIX}${formatProxiedShare(page)}`),
      options.canCreateRule
        ? button(CREATE_RULE_LABEL, { variant: 'primary', onClick: () => options.onCreateRule(page.page) })
        : null,
    ),
    requestLogTable(page.rows, options.rowActions),
  )
}
