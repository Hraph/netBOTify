import { ClientIdentifier } from "../models/ClientIdentifier";
import { ServerConfig } from "../models/ServerConfig";
import { GetIdentityCallback, ReleaseIdentityCallback } from "../models/WorkerIdentity";
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
    constructor(config?: ServerConfig);
    private _internalActions;
    private _releaseWorkerIdentity;
    private _sendEventToSubscribedCLIs;
    private _saveTaskParameters;
    private _saveWorkerLog;
    private _saveWorkerResult;
    private _saveWorkerB64Image;
    connect(): void;
    onTaskResult(callback: (result: any, client: any) => void): void;
    onTaskEvent(eventName: string, callback: (data: any, client: any) => void): void;
    onTaskEnded(callback: (data: any, client: any) => void): void;
    addGlobalParameter(key: string, defaultValue: any, value?: any): void;
    addServerAction(name: string, callback: Function): void;
    declareWorkerTask(name: string): void;
    onWorkerGetIdentity(callback: GetIdentityCallback): void;
    onWorkerReleaseIdentity(callback: ReleaseIdentityCallback): void;
}
