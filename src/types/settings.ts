import { KeepAliveProxyRule, ProxyListItem, ProxyRule, RuntimeProxyRule } from './proxy'
import { ProxyId } from '@customTypes/generic'

export type GeoBypassSettings = {
  proxyList: ProxyListItem[];
  defaultProxy?: ProxyId;
  fallbackDirect?: boolean;
  rules: ProxyRule[];
  keepAliveRules?: KeepAliveProxyRule;
  testProxyUrl: string;
  perWebsiteOverride: Record<string, ProxyId>;
}

export type GeoBypassRuntimeSettings = Omit<GeoBypassSettings, 'rules'> & {
  rules: RuntimeProxyRule[];
}
