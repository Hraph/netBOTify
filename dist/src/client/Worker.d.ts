import { Client } from "./Client";
import { GlobalParameterList } from "../models/GlobalParameter";
import { WorkerConfig } from "../models/WorkerConfig";
import { WorkerIdentity } from "../models/WorkerIdentity";
import { Logger } from "log4js";
export declare class Worker extends Client {
    private taskEvent;
    constructor(config?: WorkerConfig);
    private _internalActions;
    onLaunchTask(callback: (identity: WorkerIdentity, parameters: GlobalParameterList, server: any) => void): void;
    onStopTask(callback: (server: any) => void): void;
    onStatusTask(callback: (server: any) => void): void;
    sendTaskResult(result?: any): void;
    sendTaskEvent(eventName: string, data?: any): void;
    sendTaskError(error?: any): void;
    sendTaskEnded(data?: any): void;
    sendB64Image(fileName: string, extension: string, buffer: string): void;
    logger(): Logger;
}
