import {Client} from "./Client";
import {TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../utils/logger";
import {TaskParameterItem, TaskParameterList} from "../models/TaskParameters";
import {WorkerConfig} from "../models/WorkerConfig";
import {TaskIdentity} from "../models/TaskIdentity";
import {Logger} from "log4js";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;

export class Worker extends Client {
    private taskEvent: any;
    private getTaskStatusCallback?: (server: any) => Promise<any>;

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
         * Actions for Task
         */
        this.client.exports.task = {
            /**
             * Action on task launch from the server
             * @param {TaskParameterList} parameters
             */
            launch: function(identity: TaskIdentity, parameters: TaskParameterList) {
                //this.serverProxy is injected by eureca

                __this.taskEvent.emit("launchTask", identity, parameters, __this.server);
                __this.server.task.onLaunched().catch((e: any) => {
                    logger.worker().error("Unable to execute command ", e);
                });
                __this.identifier.taskStatus = TaskStatus.Running;
            },
            /**
             * Action on task stop from the server
             */
            stop: function() {
                //this.serverProxy is injected by eureca

                __this.taskEvent.emit("stopTask", __this.server);
                __this.server.task.onStopped().catch((e: any) => {
                    logger.worker().error("Unable to execute command ", e);
                });
                __this.identifier.taskStatus = TaskStatus.Idle;
            },

        };

        /**
         * Action for Task Task status
         */
        this.client.exports.task.status = {
            /**
             * Action on status request from the server
             */
            get: function() {
                //this.serverProxy is injected by eureca
                let context = this;
                context.async = true; //Define an asynchronous return

                if (__this.getTaskStatusCallback !=  null)
                    return __this.getTaskStatusCallback(__this.server).then(data => context.return(data));
                else
                    context.return(null);
            }
        };


        /**
         * Action on custom event from the server
         */
        this.client.exports.onEvent = function(eventName: string, data: any = null) {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("serverEvent:" + eventName, __this.server, data);
        };
    }

    /**
     * Public methods for Task management
     */
    public task = {
        /**
         * Add handler on task launch request event
         * @param {(parameters: TaskParameterList, server: any) => void} callback
         */
        onLaunchTask: (callback: (identity: TaskIdentity, parameters: TaskParameterList, server: any) => void) => {
            this.taskEvent.on("launchTask", callback);
        },
        /**
         * Add handler on task stop request event
         * @param {(server: any) => void} callback
         */
        onStopTask: (callback: (server: any) => void) => {
            this.taskEvent.on("stopTask", callback);
        },
        /**
         * Add handler on task end request event
         * @param {(server: any) => void} callback
         */
        onStatusTask: (callback: (server: any) => Promise<any>) => {
            this.getTaskStatusCallback = callback;
        },
        /**
         * Send the task result to the server
         * @param result
         */
        sendTaskResult: (result: any = null) => {
            if (this.server !== null)
            this.server.task.onResult(result);
        },
        /**
         * Send a custom event to the server
         * @param {string} eventName
         * @param data
         */
        sendTaskEvent: (eventName: string, data: any = null) => {
            if (this.server !== null)
            this.server.task.onEvent(eventName, data);
        },
        /**
         * Send task error
         * @param error
         */
        sendTaskError: (error: any = null) => {
            if (this.server !== null)
            this.server.task.onError(error);
            this.identifier.taskStatus = TaskStatus.Error;
        },
        /**
         * Send task end status to the server
         * @param data
         */
        sendTaskEnded: (data: any = null) => {
            if (this.server !== null)
            this.server.task.onEnded(data);
            this.identifier.taskStatus = TaskStatus.Ended;
        },
        /**
         * Send file buffer to the server
         * @param {string} fileName
         * @param {string} extension
         * @param {string} buffer
         */
        sendB64Image: (fileName: string, extension: string, buffer: string) => {
            if (this.server !== null)
            this.server.task.b64Image(fileName, extension, buffer);
        }
    };

    /**
     * Public methods for events
     */
    public events = {
        /**
         * Add handler on custom server event
         * @param {string} eventName
         * @param data
         */
        onServerEvent: (eventName: string, callback: (server: any, data: any) => any) => {
            this.taskEvent.on("serverEvent:" + eventName, callback);
        },
    };


    /**
     * Get the worker logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.worker();
    }
}