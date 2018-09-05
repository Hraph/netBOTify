import { ClientIdentifier } from "./ClientIdentifier";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    private serverEvent;
    private subscribedCLISToEvents;
    constructor(config?: any);
    private _internalActions;
    private _sendEventToSubscribedCLIs;
    private _saveTaskParameters;
    /**
     * Launch server
     */
    connect(): void;
    onTaskResult(callback: (result: any, client: any) => void): void;
    onTaskEvent(eventName: string, callback: (data: any, client: any) => void): void;
    onTaskEnded(callback: (data: any, client: any) => void): void;
    addTaskParameter(key: string, defaultValue: any, value?: any): void;
    addServerAction(name: string, callback: Function): void;
    addWorkerTask(name: string): void;
}
