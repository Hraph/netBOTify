import { Client } from "./Client";
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
        onTaskResult: (callback: (result: any, workerToken: string) => void) => void;
        onTaskError: (callback: (error: any, workerToken: string) => void) => void;
    };
    tunnel: {
        onTunnelError: (callback: (error: any, workerToken: string) => void) => void;
    };
    events: {
        onEvent: (eventName: string, callback: (data: any, workerToken: string) => void) => void;
        onAnyEvent: (callback: (eventName: string, data: any, workerToken: string) => void) => void;
    };
    customize: {
        addCommand: (commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void, options?: {
            key: string;
            description: string;
        }[] | undefined) => void;
        getVorpalInstance: () => any;
    };
}
