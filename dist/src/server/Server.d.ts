import { ClientIdentifier } from "../models/ClientIdentifier";
import { GlobalParameter } from "../models/GlobalParameter";
import { ServerConfig } from "../models/ServerConfig";
import { GetIdentityCallback, ReleaseIdentityCallback } from "../models/WorkerIdentity";
import { Logger } from "log4js";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private globalParameters;
    private serverEvent;
    private subscribedCLISToEvents;
    private saveLogToDirectory;
    private saveResultToFile;
    private identityCallback?;
    private releaseIdentityCallback?;
    private filteredClientIdentifierCLIKeys;
    private filteredClientIdentifierWorkerKeys;
    constructor(config?: ServerConfig);
    private _reduceObjectToAllowedKeys;
    private _internalActions;
    private _releaseWorkerIdentity;
    private _sendEventToSubscribedCLIs;
    private _saveTaskParameters;
    private _saveWorkerLog;
    private _saveWorkerResult;
    private _saveWorkerB64Image;
    connect(): void;
    onTaskResult(callback: (result: any, identifier: ClientIdentifier, workerProxy: any) => void): void;
    onTaskEvent(eventName: string, callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void): void;
    onTaskEnded(callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void): void;
    addGlobalParameter(key: string, defaultValue: any, value?: any): void;
    getGlobalParameter(key: string): false | GlobalParameter<any>;
    addServerAction(name: string, callback: Function): void;
    declareWorkerTask(name: string): void;
    onWorkerGetIdentity(callback: GetIdentityCallback): void;
    onWorkerReleaseIdentity(callback: ReleaseIdentityCallback): void;
    logger(): Logger;
}