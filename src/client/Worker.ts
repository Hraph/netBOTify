import {Client} from "./Client";
import {TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../logger";
import {GlobalParameter, GlobalParameterList} from "../models/GlobalParameter";
import {WorkerConfig} from "../models/WorkerConfig";
import {WorkerIdentity} from "../models/WorkerIdentity";
import {Logger} from "log4js";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;

export class Worker extends Client {
    private taskEvent: any;
    private onGetStatusCallback?: (server: any) => any;

    constructor(config: WorkerConfig = {}){
        super(config); //Create client
    
        this.taskEvent = new EventEmitter();
        
        try {
            /**
             * Set logger config
             */
            if (config.logger)
                logger.setWorkerLevel(config.logger);
    
            /**
             * Client internal events handling
             */
             this.client.ready((serverProxy: any) => { //Triggered ONCE when first time authenticated
                logger.worker().debug('Connected to server');
            });
            
            this.client.onConnect((client: any) => {
                if (this.client.isReady()) //Client reconnected
                    logger.worker().debug('Reconnected to server');
            });
    
            this.client.onUnhandledMessage(function (data: any) {
                logger.worker().debug('Received message: ', data);
            });
    
            this.client.onError(function (e: any) {
                if (e.type === "TransportError") {
                    logger.worker().error("Unable to connect to server: code", e.description);
                }
                else {
                    logger.worker().error('Unknown error ', e);
                }
            });
    
            this.client.onConnectionLost(function () {
                logger.worker().warn('Connection lost ... will try to reconnect');
            });
    
            this.client.onConnectionRetry(function (socket: any) {
                logger.worker().warn('retrying ...');
            });
    
            this.client.onDisconnect(function (socket: any) {
                logger.worker().debug('Client disconnected ', socket.id);
            });
    
            this._internalActions(this);
        }
        catch(e) {
            logger.worker().error("Error while constructing worker: " + e);
            process.exit(1);
        }
    }

    /**
     * Define all internal RPC methods callable for the worker
     * @param {Worker} __this
     * @private
     */
    private _internalActions(__this: Worker){
        /**
         * Action on task launch from the server
         * @param {GlobalParameterList} parameters
         */
        this.client.exports.launchTask = function(identity: WorkerIdentity, parameters: GlobalParameterList) {
            //this.serverProxy is injected by eureca
            
            __this.taskEvent.emit("launchTask", identity, parameters, __this.server);
            __this.server.task.taskLaunched().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Running;
        };

        /**
         * Action on task stop from the server
         */
        this.client.exports.stopTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Idle;
        };

        /**
         * Action on status request from the server
         */
        this.client.exports.statusTask = function() {
            //this.serverProxy is injected by eureca
            if (__this.onGetStatusCallback !=  null)
                return __this.onGetStatusCallback(__this.server);
            else
                return null;
        };

        /**
         * Action on custom event from the server
         */
        this.client.exports.workerOnEvent = function(eventName: string, data: any = null) {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("serverEvent:" + eventName, __this.server, data);
        };
    }

    /**
     * Add handler on task launch request event
     * @param {(parameters: GlobalParameterList, server: any) => void} callback
     */
    public onLaunchTask(callback: (identity: WorkerIdentity, parameters: GlobalParameterList, server: any) => void){
        this.taskEvent.on("launchTask", callback);
    }

    /**
     * Add handler on task stop request event
     * @param {(server: any) => void} callback
     */
    public onStopTask(callback: (server: any) => void){
        this.taskEvent.on("stopTask", callback);
    }

    /**
     * Add handler on task end request event
     * @param {(server: any) => void} callback
     */
    public onStatusTask(callback: (server: any) => void){
        this.onGetStatusCallback = callback;
    }

    /**
     * Add handler on custom server event
     * @param {string} eventName
     * @param data
     */
    public onServerEvent(eventName: string, callback: (data: any, server: any) => any){
        this.taskEvent.on("serverEvent:" + eventName, callback);
    }

    /**
     * Send the task result to the server
     * @param result
     */
    public sendTaskResult(result: any = null){
        if (this.server !== null)
            this.server.task.taskResult(result);
    }

    /**
     * Send a custom event to the server
     * @param {string} eventName
     * @param data
     */
    public sendTaskEvent(eventName: string, data: any = null){
        if (this.server !== null)
            this.server.task.taskEvent(eventName, data);
    }

    /**
     * Send task error
     * @param error
     */
    public sendTaskError(error: any = null){
        if (this.server !== null)
            this.server.task.taskError(error);
        this.identifier.taskStatus = TaskStatus.Error;
    }

    /**
     * Send task end status to the server
     * @param data
     */
    public sendTaskEnded(data: any = null){
        if (this.server !== null)
            this.server.task.taskEnded(data);
        this.identifier.taskStatus = TaskStatus.Ended;
    }
    
    /**
     * Send file buffer to the server
     * @param {string} fileName
     * @param {string} extension
     * @param {string} buffer
     */
     public sendB64Image(fileName: string, extension: string, buffer: string){
         if (this.server !== null)
            this.server.task.b64Image(fileName, extension, buffer);
     }

    /**
     * Get the worker logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.worker();
    }
}