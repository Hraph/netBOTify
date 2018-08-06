import { ClientIdentifier } from "./ClientIdentifier";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private _internalActions;
    constructor(config?: any);
    /**
     * Launch server
     */
    connect(): void;
    addServerAction(name: string, callback: Function): void;
    addWorkerTask(name: string): void;
}
