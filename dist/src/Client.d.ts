import { ClientIdentifier } from "./ClientIdentifier";
export declare class Client {
    protected config: any;
    protected client: any;
    protected server: any;
    protected identifier: ClientIdentifier;
    private pingInterval;
    private pingTimeout;
    private pingIntervalSecond;
    private pingTimeoutSecond;
    /**
     * Launch ping interval
     * @param server
     */
    protected launchPing(server: any): void;
    /**
     * Stop ping to avoid flood if connection is lost
     */
    protected stopPing(): void;
    protected constructor(config?: any);
    /**
     * Defines default Client config
     * @param config
     * @returns {{}}
     * @private
     */
    private _sanitizeConfig;
    /**
     * Add an item to config
     * @param {string} name
     * @param item
     * @returns {this}
     */
    addConfigItem(name: string, item: any): this;
}
