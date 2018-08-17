import { Client } from "./Client";
export declare class RemoteCLI extends Client {
    private taskEvent;
    constructor(config?: any);
    addCommand(commandWord: string, commandDescription: string, callback: (args: any, callback: Function) => void): void;
    private _executePrintDistantCommand;
    private _executeTableDistantCommand;
    private _serverInvalidCommandError;
}
