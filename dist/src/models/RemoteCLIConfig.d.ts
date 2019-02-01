import { ClientConfig } from "./ClientConfig";
export interface RemoteCLIConfig extends ClientConfig {
    autoSubscribe?: boolean;
    delimiter?: string;
    disableInput?: boolean;
}
