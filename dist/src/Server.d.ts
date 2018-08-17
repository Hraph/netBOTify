import { ClientIdentifier } from "./ClientIdentifier";
import { TaskParameter } from "./TaskParameter";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    private _internalActions;
    constructor(config?: any);
    /**
     * Launch server
     */
    connect(): void;
    addTaskParameter(parameter: TaskParameter): void;
    addServerAction(name: string, callback: Function): void;
    addWorkerTask(name: string): void;
}
