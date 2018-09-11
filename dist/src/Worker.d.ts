import { Client } from "./Client";
import { TaskParameterList } from "./TaskParameter";
export declare class Worker extends Client {
    private taskEvent;
    constructor(config?: any);
    /**
     * Define all internal RPC methods callable for the worker
     * @param {Worker} __this
     * @private
     */
    private _internalActions;
    /**
     * Add handler on task launch request event
     * @param {(parameters: TaskParameterList, server: any) => void} callback
     */
    onLaunchTask(callback: (parameters: TaskParameterList, server: any) => void): void;
    /**
     * Add handler on task stop request event
     * @param {(server: any) => void} callback
     */
    onStopTask(callback: (server: any) => void): void;
    /**
     * Add handler on task end request event
     * @param {(server: any) => void} callback
     */
    onStatusTask(callback: (server: any) => void): void;
    /**
     * Send the task result to the server
     * @param result
     */
    sendTaskResult(result?: any): void;
    /**
     * Send a custom event to the server
     * @param {string} eventName
     * @param data
     */
    sendTaskEvent(eventName: string, data?: any): void;
    /**
     * Send task end status to the server
     * @param data
     */
    sendTaskEnded(data?: any): void;
}
