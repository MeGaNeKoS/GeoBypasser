import { newId, upsert } from '../collections'
import { proxySelect } from '../components/proxy-select'
import { textField } from '../components/fields'
import { draftOf, draftValue, faultFor, faultsOnOpen, openSheet, type Draft, type Fault } from '../components/sheet'
import type { Browser, SiteEntry } from '../model'
import type { SectionContext } from '../pages/section-context'
import { defaults, sites } from '../sample-data'

const DOMAIN = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/i

const FIREFOX_DOMAIN_HELP = 'Covers tabs on this domain and its subdomains, including everything those pages load.'
const CHROME_DOMAIN_HELP = 'Covers requests to this domain and its subdomains. Things the page loads from other hosts are not covered.'

export function openSiteSheet (entry: SiteEntry | null, context: SectionContext): void {
  const browser = context.store.get().browser
  const draft = draftOf({ domain: entry?.domain ?? '', proxyId: entry?.proxyId ?? defaults.defaultProxyId })
  openSheet({
    title: entry ? 'Edit website override' : 'Add website override',
    saveLabel: 'Save override',
    draft,
    initialFaults: faultsOnOpen(entry?.faults ?? [], draft, validateSite),
    render: (current, faults) => siteBody(current, faults, browser),
    validate: validateSite,
    save: current => saveSite(entry, current, context),
  })
}

function siteBody (draft: Draft, faults: Fault[], browser: Browser): Node[] {
  return [
    textField({
      name: 'domain',
      label: 'Domain',
      value: draftValue(draft, 'domain'),
      mono: true,
      help: browser === 'chrome' ? CHROME_DOMAIN_HELP : FIREFOX_DOMAIN_HELP,
      fault: faultFor(faults, 'domain'),
    }),
    proxySelect({ name: 'proxyId', label: 'Proxy', selectedId: draftValue(draft, 'proxyId'), fault: faultFor(faults, 'proxyId') }),
  ]
}

function validateSite (draft: Draft): Fault[] {
  const faults: Fault[] = []
  if (!DOMAIN.test(draftValue(draft, 'domain').trim())) {
    faults.push({ field: 'domain', message: 'Enter a domain such as example.com.' })
  }
  if (draftValue(draft, 'proxyId') === '') {
    faults.push({ field: 'proxyId', message: 'Choose a proxy.' })
  }
  return faults
}

function saveSite (entry: SiteEntry | null, draft: Draft, context: SectionContext): void {
  upsert(sites, {
    id: entry?.id ?? newId('site'),
    domain: draftValue(draft, 'domain').trim().toLowerCase(),
    proxyId: draftValue(draft, 'proxyId'),
    faults: [],
  })
  context.refresh('Saved')
}
