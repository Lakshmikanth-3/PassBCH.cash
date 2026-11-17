// Electrum provider with failover. Public chipnet servers drop connections; we replace the provider
// (cashscript's auto-managed client cannot be reconnected manually) and rotate to the next host.
import { ElectrumNetworkProvider } from '@passrate/shared/tickettx';
import { NETWORK } from './config.js';

export const HOSTS = { chipnet: ['chipnet.bch.ninja', 'chipnet.imaginary.cash'] };

let i = 0;
export function makeProvider() {
  const hosts = HOSTS[NETWORK];
  const hostname = hosts[i++ % hosts.length];
  const p = new ElectrumNetworkProvider(NETWORK, { hostname });
  p.hostname = hostname;
  return p;
}
