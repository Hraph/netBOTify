import { Client } from "./Client";
export declare class Worker extends Client {
    private taskEvent;
    constructor(config?: any);
    onLaunchTask(callback: (server: any) => void): void;
    onStopTask(callback: (server: any) => void): void;
    private _internalActions;
}
