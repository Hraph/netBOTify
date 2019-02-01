import { Client } from "./Client";
import { ClientIdentifier } from "../models/ClientIdentifier";
import { RemoteCLIConfig } from "../models/RemoteCLIConfig";
import { Logger } from "log4js";
export declare class RemoteCLI extends Client {
    private cliEvent;
    private globalParameters;
    constructor(config?: RemoteCLIConfig);
    private _setupTaskParameters;
    private _getServerGlobalParameters;
    private _executeDistantCommand;
    private _objectGroupByPropertyAndCount;
    private _objectGroupByProperty;
    private _serverInvalidCommandError;
    addCommand(commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void, options?: [{
        key: string;
        description: string;
    }]): void;
    logger(): Logger;
    onTaskResult(callback: (result: any, identifier: ClientIdentifier, workerToken: string) => void): void;
    onTaskEvent(eventName: string, callback: (data: any, identifier: ClientIdentifier, workerToken: string) => void): void;
    onTaskAnyEvent(callback: (eventName: string, data: any, identifier: ClientIdentifier, workerToken: string) => void): void;
}
