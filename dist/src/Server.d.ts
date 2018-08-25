import { ClientIdentifier } from "./ClientIdentifier";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    private serverEvent;
    constructor(config?: any);
    private _internalActions;
    private _saveTaskParameters;
    /**
     * Launch server
     */
    connect(): void;
    onTaskEnded(callback: (result: any, client: any) => void): void;
    addTaskParameter(key: string, defaultValue: any, value?: any): void;
    addServerAction(name: string, callback: Function): void;
    addWorkerTask(name: string): void;
}
