import type { Types } from 'webextension-polyfill'
import type { ProxyControlState } from '@customTypes/proxyControl'
import type { ProxyControlMessage } from '@customTypes/messages'
import { canApplyPac, proxyControlStateFor } from '@utils/proxyControl'
import { isProxyControlMessage } from '@utils/messages'

export type ProxyControlPorts = {
  readLevelOfControl: () => Promise<Types.LevelOfControl>;
  broadcastState: (state: ProxyControlState) => Promise<void>;
  applyPac: () => Promise<void>;
}

export function createProxyControl (ports: ProxyControlPorts) {
  async function readState (): Promise<ProxyControlState> {
    return proxyControlStateFor(await ports.readLevelOfControl())
  }

  return {
    async start () {
      await ports.applyPac()
      await ports.broadcastState(await readState())
    },

    async levelOfControlChanged (levelOfControl: Types.LevelOfControl) {
      const state = proxyControlStateFor(levelOfControl)
      if (canApplyPac(state)) await ports.applyPac()
      await ports.broadcastState(state)
    },

    answerRequest (message: unknown): Promise<{ state: ProxyControlState }> | undefined {
      if (!isGetProxyControlMessage(message)) return undefined
      return readState().then(state => ({ state }))
    },
  }
}

export function isGetProxyControlMessage (message: unknown): message is ProxyControlMessage {
  return isProxyControlMessage(message) && message.type === 'getProxyControl'
}
