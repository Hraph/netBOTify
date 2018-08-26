import { Client } from "./Client";
import { TaskParameterList } from "./TaskParameter";
export declare class Worker extends Client {
    private taskEvent;
    constructor(config?: any);
    onLaunchTask(callback: (parameters: TaskParameterList, server: any) => void): void;
    onStopTask(callback: (server: any) => void): void;
    onStatusTask(callback: (server: any) => void): void;
    sendTaskResult(result?: any): void;
    sendTaskEnded(data?: any): void;
    private _internalActions;
}
