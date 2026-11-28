import { supportsProxyOnRequest } from '@utils/env'
import { siteFormFaults, siteMapAfterSave } from '@utils/siteDraft'
import type { SiteForm } from '@utils/siteDraft'
import { textField } from '../components/fields'
import { proxySelectField } from '../components/proxy-select'
import { draftOf, draftValue, faultFor, openSheet } from '../components/sheet'
import type { Draft, Fault } from '../components/sheet'
import { readProxyList } from '../proxies/proxyStore'
import { changeSiteMap } from './siteStore'

export type SiteEditorOptions = {
  entry?: { domain: string; proxyId: string; needsReview?: boolean };
  onSaved?: () => void;
}

const FIREFOX_DOMAIN_HELP = 'Covers tabs on this domain and its subdomains, including everything those pages load.'
const CHROME_DOMAIN_HELP = 'Covers requests to this domain and its subdomains. Things the page loads from other hosts are not covered.'

export async function openSiteEditor (options: SiteEditorOptions): Promise<void> {
  const proxyList = await readProxyList()
  openSheet({
    title: options.entry ? 'Edit site' : 'Add site',
    saveLabel: 'Save',
    draft: draftOf({ domain: options.entry?.domain ?? '', proxyId: options.entry?.proxyId ?? '' }),
    initialFaults: options.entry?.needsReview ? siteFormFaults(options.entry) : undefined,
    render: (draft, faults) => renderFields(formFromDraft(draft), proxyList, faults),
    validate: draft => siteFormFaults(formFromDraft(draft)),
    save: draft => void saveSite(formFromDraft(draft), options),
  })
}

async function saveSite (form: SiteForm, options: SiteEditorOptions): Promise<void> {
  await changeSiteMap(map => siteMapAfterSave(map, form, options.entry?.domain))
  options.onSaved?.()
}

function formFromDraft (draft: Draft): SiteForm {
  return { domain: draftValue(draft, 'domain'), proxyId: draftValue(draft, 'proxyId') }
}

function renderFields (form: SiteForm, proxyList: unknown, faults: Fault[]): Node[] {
  return [
    textField({
      name: 'domain', label: 'Domain', value: form.domain, mono: true,
      help: supportsProxyOnRequest ? FIREFOX_DOMAIN_HELP : CHROME_DOMAIN_HELP,
      fault: faultFor(faults, 'domain'),
    }),
    proxySelectField({ name: 'proxyId', label: 'Proxy', proxyList, proxyId: form.proxyId, fault: faultFor(faults, 'proxyId') }),
  ]
}
