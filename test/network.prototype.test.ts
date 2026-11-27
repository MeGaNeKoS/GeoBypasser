import { addNetworkData, networkStats, resetNetworkStats } from '@utils/network'

const PROTOTYPE_NAMES = ['__proto__', 'constructor', 'prototype', 'hasOwnProperty', 'toString']

describe('network stats with segment names that Object.prototype also has', () => {
  beforeEach(() => resetNetworkStats())

  it.each(PROTOTYPE_NAMES)('counts a path segment named %s as its own child', name => {
    addNetworkData(`https://a.example/${name}/b`, 3, 4)

    expect(Object.keys(networkStats.domains['a.example'].children!)).toContain(name)
    expect(networkStats.domains['a.example'].children![name].sent).toBe(3)
    expect(networkStats.domains['a.example'].children![name].children!['b'].received).toBe(4)
  })

  it.each(PROTOTYPE_NAMES)('counts a host named %s as its own domain', name => {
    const host = `${name.toLowerCase()}.example`
    addNetworkData(`https://${name}.example/`, 5, 6)

    expect(Object.keys(networkStats.domains)).toContain(host)
    expect(networkStats.domains[host].received).toBe(6)
  })

  it('writes nothing onto Object.prototype or plain objects', () => {
    const before = Object.getOwnPropertyNames(Object.prototype).sort()

    addNetworkData('https://host.example/__proto__/x', 3, 4)
    addNetworkData('https://host.example/constructor/prototype', 7, 8)

    expect(({} as Record<string, unknown>).sent).toBeUndefined()
    expect(({} as Record<string, unknown>).received).toBeUndefined()
    expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before)
  })

  it('serializes to the same tree shape as the other segments', () => {
    addNetworkData('https://a.example/constructor/b', 1, 2)

    expect(JSON.parse(JSON.stringify(networkStats))).toEqual({
      total: { sent: 1, received: 2, children: {} },
      domains: {
        'a.example': {
          sent: 1,
          received: 2,
          children: {
            constructor: {
              sent: 1,
              received: 2,
              children: { b: { sent: 1, received: 2, children: {} } },
            },
          },
        },
      },
    })
  })
})
