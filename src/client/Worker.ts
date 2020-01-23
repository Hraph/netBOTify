import {Client} from "./Client";
import {TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../utils/logger";
import {TaskParameterList} from "../models/TaskParameters";
import {WorkerConfig} from "../models/WorkerConfig";
import {Logger} from "log4js";
import {Tunnel, TunnelProvider, TunnelStatus, WorkerTunnel} from "../models/WorkerTunnel";
import {WorkerTunnelNgrok} from "./WorkerTunnels";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;

export class Worker extends Client {
    private taskEvent: any;
    private getTaskStatusCallback?: (server: any) => Promise<any>;
    private tunnels: {[key: number]: Tunnel} = {};
    private tunnelProvider?: WorkerTunnel;

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
             * Set tunnel config
             */
            try{
                if (config.tunnelProvider) {
                    if (config.tunnelProvider == TunnelProvider.Ngrok) {
                        this.tunnelProvider = new WorkerTunnelNgrok(config.tunnelProviderConfig);
                    }
                    else
                        logger.worker().error(`Invalid Tunnel provider: ${config.tunnelProvider}`);
                }
            }
            catch(e){
                logger.worker().error(`Tunnel error: ${e}`);
            }
    
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
            launch: function(identity: any, parameters: TaskParameterList) {
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
         * Action for Task status
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
         * Action for Tunnel
         */
        this.client.exports.tunnel = {
            /**
             * Create a tunnel to the localPort using the configured provider
             * @param localPort
             * @param isTcp
             */
            create: async function (localPort: number, isTcp: boolean = true) {
                //this.serverProxy is injected by eureca
                let context = this;
                context.async = true; //Define an asynchronous return

                if (__this.tunnelProvider) { // Provider is set
                    try {
                        if (!__this.tunnels.hasOwnProperty(localPort)) // Create object
                            __this.tunnels[localPort] = {
                                localPort: localPort,
                                url: "",
                                provider: __this.tunnelProvider.type,
                                status: TunnelStatus.Stopped
                            };

                        if (__this.tunnels[localPort].status === TunnelStatus.Stopped) {
                            let url = await __this.tunnelProvider.connect(localPort, isTcp, (status: TunnelStatus) => {
                                __this.tunnels[localPort].status = status; // Change status on reconnect
                            });

                            __this.tunnels[localPort].url = url; // Save url
                            __this.tunnels[localPort].status = TunnelStatus.Connected; // If no error it's now connected

                            logger.worker().debug(`Tunnel created on port ${localPort}: ${url} `);
                            __this.server.tunnel.onEvent("tunnelCreated", url); // Send event

                            return context.return(__this.tunnels[localPort]); // Send success
                        }
                        else { // Alrady started
                            logger.worker().debug(`Tunnel error: Tunnel already started ${localPort}`);
                            __this.server.tunnel.onError(`Tunnel error: Tunnel already started ${localPort}`); // Send error to server

                            return context.return(__this.tunnels[localPort]);
                        }
                    }
                    catch(e) {
                        logger.worker().error(e);
                        __this.server.tunnel.onError(`Tunnel error: ${e}`); // Send error to server

                        return context.return(null);
                    }
                }
                else
                    __this.server.tunnel.onError(`Tunnel error: provider not setup!`); // Send error to server
            },
            /**
             * Stop the previously crated tunnel
             * @param localPort
             */
            stop: async function(localPort: number, killAll: boolean = false) {
                //this.serverProxy is injected by eureca
                let context = this;
                context.async = true; //Define an asynchronous return

                if (__this.tunnelProvider) {
                    try {
                        if (killAll){ // Remove all tunnels
                            await __this.tunnelProvider.kill();
                            let count = Object.keys(__this.tunnels).length;
                            __this.tunnels = [];

                            logger.worker().debug(`All tunnels killed`);

                            return context.return(count);
                        }
                        else {
                            // Tunnel exist / has already been connected and url exist and not empty
                            if (__this.tunnels.hasOwnProperty(localPort) && __this.tunnels[localPort].status != TunnelStatus.Stopped && __this.tunnels[localPort].url) {
                                await __this.tunnelProvider.disconnect(__this.tunnels[localPort].url);

                                // Erase tunnel
                                __this.tunnels[localPort].url = "";
                                __this.tunnels[localPort].status = TunnelStatus.Stopped;

                                logger.worker().debug(`Tunnel stopped on port ${localPort}`);
                                __this.server.tunnel.onEvent("tunnelStopped", localPort); // Send event

                                return context.return(1);
                            }
                            // Else never created
                            else {
                                logger.worker().debug(`Tunnel error: No tunnel exists on port ${localPort}`);
                                __this.server.tunnel.onError(`Tunnel error: No tunnel exists on port ${localPort}`); // Send error to server

                                return context.return(0);
                            }
                        }
                    }
                    catch(e) {
                        logger.worker().error(e);
                        __this.server.tunnel.onError(`Tunnel error: ${e}`); // Send error to server

                        return context.return(0);
                    }
                }
                else
                    __this.server.tunnel.onError(`Tunnel error: provider not setup!`); // Send error to server
            },
            /**
             * Get ALL the tunnels opened on the worker
             */
            get: function() {
                //this.serverProxy is injected by eureca
                let context = this;
                context.async = true; //Define an asynchronous return

                return context.return(Object.values(__this.tunnels)); // Send an array of value without keys
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
        onLaunchTask: (callback: (identity: any, parameters: TaskParameterList, server: any) => void) => {
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
        onServerEvent: (eventName: string, callback: (server: any, ...data: any) => any) => {
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