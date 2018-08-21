import { Client } from "./Client";
export declare class RemoteCLI extends Client {
    private taskEvent;
    private taskParameters;
    constructor(config?: any);
    addCommand(commandWord: string, commandDescription: string, callback: (args: any, callback: Function) => void): void;
    private _setupTaskParameters;
    private _getServerTaskParameters;
    private _executeDistantCommand;
    private _serverInvalidCommandError;
}
