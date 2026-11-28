import { formatProxiedShare, type RequestLogPage } from '@utils/requestLog'
import { element } from '../dom'
import { requestLogTable, type LogRowActions } from './requestLogTable'

const THROUGH_PROXIES_PREFIX = 'Through proxies: '

export function requestLogPageGroup (page: RequestLogPage, rowActions: LogRowActions): HTMLElement {
  return element('section', { class: 'log-page', 'aria-label': page.page },
    element('div', { class: 'log-page__head' },
      element('h3', { class: 'mono' }, page.page),
      element('span', { class: 'muted' }, `${THROUGH_PROXIES_PREFIX}${formatProxiedShare(page)}`),
    ),
    requestLogTable(page.rows, rowActions),
  )
}
