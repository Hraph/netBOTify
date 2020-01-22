import { ClientIdentifier } from "../models/ClientIdentifier";
import { TaskParameterItem } from "../models/TaskParameters";
import { ServerConfig } from "../models/ServerConfig";
import { GetIdentityCallback, ReleaseIdentityCallback } from "../models/TaskIdentity";
import { Logger } from "log4js";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    private serverEvent;
    private subscribedCLISToEvents;
    private saveLogToDirectory;
    private saveResultToFile;
    private identityCallback?;
    private releaseIdentityCallback?;
    private filteredClientIdentifierCLIKeys;
    private filteredClientIdentifierWorkerKeys;
    constructor(config?: ServerConfig);
    private _internalActions;
    private _releaseTaskIdentity;
    private _saveTaskParameters;
    private _saveWorkerLog;
    private _saveWorkerResult;
    private _saveWorkerB64Image;
    connect(): void;
    logger(): Logger;
    task: {
        onTaskResult: (callback: (result: any, identifier: ClientIdentifier, workerProxy: any) => void) => void;
        onTaskEvent: (eventName: string, callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void) => void;
        onTaskAnyEvent: (callback: (eventName: string, data: any, identifier: ClientIdentifier, workerProxy: any) => void) => void;
        onTaskEnded: (callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void) => void;
        addTaskParameter: (key: string, defaultValue: any, value?: any) => void;
        getTaskParameter: (key: string) => false | TaskParameterItem<any>;
        onTaskIdentityAcquired: (callback: GetIdentityCallback) => void;
        onTaskIdentityReleased: (callback: ReleaseIdentityCallback) => void;
    };
    events: {
        sendEventToSubscribedCLIs: (eventName: string, data: any, workerToken: string) => void;
        sendEventToWorkers: (eventName: string, data: any, token?: any) => void;
    };
    customize: {
        addServerAction: (name: string, callback: Function) => void;
        registerWorkerTask: (name: string) => void;
    };
}
