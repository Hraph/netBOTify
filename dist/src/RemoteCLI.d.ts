import { Client } from "./Client";
export declare class RemoteCLI extends Client {
    private taskEvent;
    constructor(config?: any);
    private _executePrintDistantCommand;
    private _executeTableDistantCommand;
    private _serverInvalidCommandError;
}
