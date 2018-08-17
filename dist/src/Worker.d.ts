import { Client } from "./Client";
import { TaskParameter } from "./TaskParameter";
export declare class Worker extends Client {
    private taskEvent;
    constructor(config?: any);
    onLaunchTask(callback: (parameters: TaskParameter[], server: any) => void): void;
    onStopTask(callback: (server: any) => void): void;
    private _internalActions;
}
