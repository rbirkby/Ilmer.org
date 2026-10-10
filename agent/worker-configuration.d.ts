// Environment inferred from cloudflare.config.ts; namespace types narrow the Durable Object RPC stubs.
import type { InferEnv, UnwrapConfig } from 'cf/config';
import type config from './cloudflare.config';
import type { Guard, HistoryAgent, PoppyClient } from './src/index';

type ConfigEnv = InferEnv<UnwrapConfig<UnwrapConfig<typeof config>['worker']>>;
declare global {
  type Env = Omit<ConfigEnv, 'AGENTS' | 'CLIENTS' | 'GUARDS'> & {
    AGENTS: DurableObjectNamespace<HistoryAgent>;
    CLIENTS: DurableObjectNamespace<PoppyClient>;
    GUARDS: DurableObjectNamespace<Guard>;
  };
}
