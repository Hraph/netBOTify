import { ClientIdentifier } from "../models/ClientIdentifier";
import { ClientConfig } from "../models/ClientConfig";
export declare class Client {
    protected config: any;
    protected client: any;
    protected server: any;
    protected identifier: ClientIdentifier;
    private pingInterval;
    private pingTimeout;
    private pingIntervalSecond;
    private pingTimeoutSecond;
    protected constructor(config?: ClientConfig);
    private _sanitizeConfig;
    protected launchPing(server: any): void;
    protected stopPing(): void;
    connect(): void;
    addConfigItem(name: string, item: any): this;
}
