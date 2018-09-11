import { ClientIdentifier } from "./ClientIdentifier";
export declare class Server {
    clients: ClientIdentifier[];
    private config;
    private server;
    private taskParameters;
    private serverEvent;
    private subscribedCLISToEvents;
    private saveLogToDirectory;
    private saveResultToFile;
    constructor(config?: any);
    /**
     * Define all internal RPC methods callable from the clients
     * @param {Server} __this
     * @private
     */
    private _internalActions;
    /**
     * Forward an event to all the subscribed CLIs
     * @param {string} eventName: The name of the event
     * @param data: Optional parameters
     * @param {string} clientId: The clientId of the origin worker
     * @private
     */
    private _sendEventToSubscribedCLIs;
    /**
     * Save the parameters for the next launch
     * @param {TaskParameterList} parameters
     * @private
     */
    private _saveTaskParameters;
    /**
     * Save the worker event to log file
     * @param {ClientIdentifier} client
     * @param {string} eventName
     * @param data
     * @private
     */
    private _saveWorkerLog;
    /**
     * Save the worker result to file
     * @param {ClientIdentifier} client
     * @param result
     * @private
     */
    private _saveWorkerResult;
    /**
     * Launch the server
     */
    connect(): void;
    /**
     * Add handler on task result event
     * @param {(result: any, client: any) => void} callback
     */
    onTaskResult(callback: (result: any, client: any) => void): void;
    /**
     * Add handler on task custom event
     * @param {string} eventName
     * @param {(data: any, client: any) => void} callback
     */
    onTaskEvent(eventName: string, callback: (data: any, client: any) => void): void;
    /**
     * Add handler on task end event
     * @param {(data: any, client: any) => void} callback
     */
    onTaskEnded(callback: (data: any, client: any) => void): void;
    /**
     * Add a custom task parameter
     * @param {string} key: The parameter key
     * @param defaultValue: Default initial value if value is not set
     * @param value: Initial value
     */
    addTaskParameter(key: string, defaultValue: any, value?: any): void;
    /**
     * Add custom server RPC method callable from clients
     * @param {string} name
     * @param {Function} callback
     */
    addServerAction(name: string, callback: Function): void;
    /**
     * Declare a client RPC method callable from the server
     * @param {string} name
     */
    declareWorkerTask(name: string): void;
}
