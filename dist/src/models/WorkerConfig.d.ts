import { ClientConfig } from "./ClientConfig";
import { TunnelProvider } from "./WorkerTunnel";
export interface WorkerConfig extends ClientConfig {
    tunnelProvider?: TunnelProvider;
    tunnelProviderConfig?: {};
}
