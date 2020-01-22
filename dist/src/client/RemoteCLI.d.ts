import { Client } from "./Client";
import { ClientIdentifier } from "../models/ClientIdentifier";
import { RemoteCLIConfig } from "../models/RemoteCLIConfig";
import { Logger } from "log4js";
export declare class RemoteCLI extends Client {
    private cliEvent;
    private taskParameters;
    constructor(config?: RemoteCLIConfig);
    private _setupTaskParameters;
    private _getServerTaskParameters;
    private _executeDistantCommand;
    private _serverInvalidCommandError;
    logger(): Logger;
    task: {
        onTaskResult: (callback: (result: any, identifier: ClientIdentifier, workerToken: string) => void) => void;
        onTaskEvent: (eventName: string, callback: (data: any, identifier: ClientIdentifier, workerToken: string) => void) => void;
        onTaskAnyEvent: (callback: (eventName: string, data: any, identifier: ClientIdentifier, workerToken: string) => void) => void;
    };
    customize: {
        addCommand: (commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void, options?: [{
            key: string;
            description: string;
        }] | undefined) => void;
    };
}
