import { Client } from "./Client";
import { RemoteCLIConfig } from "../models/RemoteCLIConfig";
import { Logger } from "log4js";
export declare class RemoteCLI extends Client {
    private taskEvent;
    private globalParameters;
    constructor(config?: RemoteCLIConfig);
    private _setupTaskParameters;
    private _getServerGlobalParameters;
    private _executeDistantCommand;
    private _serverInvalidCommandError;
    addCommand(commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void): void;
    logger(): Logger;
}
