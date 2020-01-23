import { Client } from "./Client";
import { TaskParameterList } from "../models/TaskParameters";
import { WorkerConfig } from "../models/WorkerConfig";
import { Logger } from "log4js";
export declare class Worker extends Client {
    private taskEvent;
    private getTaskStatusCallback?;
    private tunnels;
    private tunnelProvider?;
    constructor(config?: WorkerConfig);
    private _internalActions;
    task: {
        onLaunchTask: (callback: (identity: any, parameters: TaskParameterList, server: any) => void) => void;
        onStopTask: (callback: (server: any) => void) => void;
        onStatusTask: (callback: (server: any) => Promise<any>) => void;
        sendTaskResult: (result?: any) => void;
        sendTaskEvent: (eventName: string, data?: any) => void;
        sendTaskError: (error?: any) => void;
        sendTaskEnded: (data?: any) => void;
        sendB64Image: (fileName: string, extension: string, buffer: string) => void;
    };
    events: {
        onServerEvent: (eventName: string, callback: (server: any, ...data: any) => any) => void;
    };
    logger(): Logger;
}
