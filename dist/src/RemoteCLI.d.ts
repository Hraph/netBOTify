import { Client } from "./Client";
export declare class RemoteCLI extends Client {
    private taskEvent;
    private taskParameters;
    constructor(config?: any);
    /**
     * Setup the registered parameters
     * Retrieve parameters on the server on the first setup
     * @param vorpalCommand: Attach the setup to a vorpal command
     * @param {boolean} reloadAll: Get new parameters from server at every calls
     * @returns {Promise<any>}
     * @private
     */
    private _setupTaskParameters;
    /**
     * Get the registered parameters on the server
     * @returns {Promise<any>}
     * @private
     */
    private _getServerTaskParameters;
    /**
     * Execute a CLI command on the server
     * @param {string} commandName
     * @param parameters
     * @returns {Promise<any>}
     * @private
     */
    private _executeDistantCommand;
    /**
     * Error handler to invalid command
     * @param e
     * @private
     */
    private _serverInvalidCommandError;
    /**
     * Add a custom command to the CLI
     * @param {string} commandWord
     * @param {string} commandDescription
     * @param {(args: any, endCommand: Function) => void} callback
     */
    addCommand(commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void): void;
}
