import { jest } from '@jest/globals'

function createEvent () {
  const listeners: Function[] = []
  return {
    addListener: (fn: any) => { listeners.push(fn) },
    removeListener: (fn: any) => {
      const i = listeners.indexOf(fn)
      if (i >= 0) listeners.splice(i, 1)
    },
    hasListener: (fn: any) => listeners.includes(fn),
    _listeners: listeners,
  }
}

const browser: any = {
    proxy: {
      onRequest: createEvent(),
      onError: createEvent(),
    },
    webRequest: {
      onAuthRequired: createEvent(),
    },
    storage: {
      local: {
        get: jest.fn(async () => ({})),
        set: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
      },
      sync: {
        get: jest.fn(async () => ({})),
        set: jest.fn(async () => {}),
        remove: jest.fn(async () => {}),
      },
      onChanged: createEvent(),
    },
    tabs: {
      get: jest.fn(async (id: number) => ({ id, url: '' })),
      query: jest.fn(async () => []),
      onUpdated: createEvent(),
      onActivated: createEvent(),
      onRemoved: createEvent(),
    },
    runtime: {
      onMessage: createEvent(),
    },
    notifications: {
      create: jest.fn(),
    },
  }

;(global as any).browser = browser

jest.mock('webextension-polyfill', () => ({ __esModule: true, default: browser, Proxy: {}, Tabs: {}, WebRequest: {} }))

export { browser }
