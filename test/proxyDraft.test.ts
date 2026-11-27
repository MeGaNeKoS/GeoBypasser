import {
  applyImportedProxy,
  duplicateIndexOf,
  proxyFormOf,
  proxyFromForm,
  proxyListReplacingAt,
  proxyListWith,
} from '@utils/proxyDraft'
import type { ProxyListItem } from '@customTypes/proxy'

const stored: ProxyListItem = {
  id: 'p1',
  label: 'Tokyo',
  type: 'socks',
  host: '203.0.113.7',
  port: 1080,
  username: 'aki',
  password: 'secret',
  proxyDNS: false,
  notifyIfDown: true,
  failoverTimeout: 10,
}

const incoming: ProxyListItem = {
  id: 'new',
  label: 'Copy me',
  type: 'socks',
  host: '203.0.113.7',
  port: 1080,
  username: 'aki',
  proxyDNS: true,
}

describe('proxy form round trip', () => {
  it('reads a stored proxy into the form and back to the same proxy', () => {
    const form = proxyFormOf(stored)
    expect(form).toEqual({
      label: 'Tokyo',
      type: 'socks',
      host: '203.0.113.7',
      port: '1080',
      username: 'aki',
      password: 'secret',
      notifyIfDown: true,
      proxyDNS: false,
      failoverTimeout: '10',
    })
    expect(proxyFromForm(form, 'p1')).toEqual(stored)
  })

  it('starts a new proxy as HTTP with DNS through the proxy on', () => {
    expect(proxyFormOf()).toMatchObject({ type: 'http', proxyDNS: true, failoverTimeout: '', port: '' })
  })

  it('leaves optional fields out of the stored proxy when the form clears them', () => {
    const cleared = { ...proxyFormOf(stored), label: '', username: '', password: '', failoverTimeout: '' }
    const proxy = proxyFromForm(cleared, 'p1')
    expect(proxy).not.toHaveProperty('label')
    expect(proxy).not.toHaveProperty('username')
    expect(proxy).not.toHaveProperty('password')
    expect(proxy).not.toHaveProperty('failoverTimeout')
  })
})

describe('proxy list edits', () => {
  it('replaces the edited proxy in place and drops cleared optional fields', () => {
    const edited = proxyFromForm({ ...proxyFormOf(stored), label: '', failoverTimeout: '' }, 'p1')
    const list = proxyListWith([stored, { ...stored, id: 'p2' }], edited)
    expect(list[0]).toEqual(edited)
    expect(list[0]).not.toHaveProperty('label')
    expect(list[1].id).toBe('p2')
  })

  it('appends a proxy whose id is not in the list', () => {
    const added = { ...stored, id: 'p3' }
    expect(proxyListWith([stored], added)).toEqual([stored, added])
  })

  it('replaces the proxy at a position even when its id is not usable', () => {
    const unnamed = { ...stored, id: '' }
    expect(proxyListReplacingAt([unnamed, stored], 0, { ...stored, id: '', host: 'edited.lan' })[0].host).toBe('edited.lan')
  })

  it('replaces a set aside null entry in place with the saved proxy', () => {
    const saved = { ...stored, id: 'proxy-new' }
    expect(proxyListReplacingAt([stored, null, stored] as ProxyListItem[], 1, saved)).toEqual([stored, saved, stored])
  })

  it('replaces a set aside text entry in place without copying its characters', () => {
    const saved = { ...stored, id: 'proxy-new' }
    expect(proxyListReplacingAt([stored, 'set aside text'] as ProxyListItem[], 1, saved)).toEqual([stored, saved])
  })
})

describe('import duplicates', () => {
  it('finds the stored proxy with the same type, host, port and username', () => {
    expect(duplicateIndexOf([stored], incoming)).toBe(0)
    expect(duplicateIndexOf([stored], { ...incoming, username: 'other' })).toBeUndefined()
  })

  it('appends a proxy that is not a duplicate', () => {
    const list = applyImportedProxy([stored], { proxy: { ...incoming, host: 'other.lan' }, copyId: 'c1' })
    expect(list.map(proxy => proxy.id)).toEqual(['p1', 'new'])
  })

  it('replace keeps the stored id', () => {
    const list = applyImportedProxy([stored], { proxy: incoming, duplicateIndex: 0, choice: 'replace', copyId: 'c1' })
    expect(list).toEqual([{ ...incoming, id: 'p1' }])
  })

  it('keep both adds a copy with a new id and the label suffix', () => {
    const list = applyImportedProxy([stored], { proxy: incoming, duplicateIndex: 0, choice: 'keepBoth', copyId: 'c1' })
    expect(list[1]).toEqual({ ...incoming, id: 'c1', label: 'Copy me (copy)' })
    expect(list[0]).toEqual(stored)
  })

  it('skip leaves the list as it was', () => {
    const list = applyImportedProxy([stored], { proxy: incoming, duplicateIndex: 0, choice: 'skip', copyId: 'c1' })
    expect(list).toEqual([stored])
  })
})
