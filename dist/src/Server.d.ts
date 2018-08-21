import { ClientIdentifier } from "./ClientIdentifier";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    constructor(config?: any);
    private _internalActions;
    /**
     * Launch server
     */
    connect(): void;
    addTaskParameter(key: string, defaultValue: any, value?: any): void;
    addServerAction(name: string, callback: Function): void;
    addWorkerTask(name: string): void;
}
