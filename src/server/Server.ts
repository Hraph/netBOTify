import {ClientIdentifier, ClientType, TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../utils/logger";
import {TaskParameterItem, TaskParameterList} from "../models/TaskParameters";
import {ServerConfig} from "../models/ServerConfig";
import {ServerStatus} from './ServerStatus';
import {Server as EurecaServer} from 'eureca.io';
import {GetIdentityCallback, ReleaseIdentityCallback, TaskIdentity} from "../models/TaskIdentity";
import {Logger} from "log4js";
import {promiseTimeout, reduceObjectToAllowedKeys} from "../utils/utils";

const express = require('express')
    , app = express()
    , webServer = require('http').createServer(app)
    , EventEmitter = require("events")
    , fs = require('fs-extra')
    , path = require('path');


/** @ignore */
declare var require: any;


export class Server {
    public clients: ClientIdentifier[] = [];
    private config: ServerConfig = {};
    private server: any;
    private taskParameters: TaskParameterList = {}; //Save the parameters for the next task launch
    private serverEvent: any;
    private subscribedCLISToEvents: string[] = []; //Save the list of subscribed CLI
    private saveLogToDirectory: boolean = false;
    private saveResultToFile: boolean = false;
    private identityCallback?: GetIdentityCallback;
    private releaseIdentityCallback?: ReleaseIdentityCallback;

    private filteredClientIdentifierCLIKeys = ["token", "ip", "groupId", "instanceId", "reconnect"]; // Reduce client identifier to some keys
    private filteredClientIdentifierWorkerKeys = ["token", "ip", "groupId", "instanceId", "reconnect", "taskStatus"]; // Reduce client identifier to some keys

    constructor(config: ServerConfig = {}){
        try {
            this.config = config;
            let __this = this; //Keep context
            this.serverEvent = new EventEmitter();

            // Configure alive http route
            app.get("/alive", (req: any, res: any) => {
                res.sendStatus(200);
            });

            // Resend catch all event
            this.serverEvent.on("taskEvent", (eventName: string, data: any, identifier: ClientIdentifier, workerProxy: any) => {
                this.serverEvent.emit("taskEvent:" + eventName, data, identifier, workerProxy);
            });
            
            /**
             * Set logger config
             */
            if (config.logger)
                logger.setServerLevel(config.logger);
    
            /**
             * Process config
             */
            this.saveLogToDirectory = (config.logDirectoryPath) ? true : false;
            this.saveResultToFile = (config.resultFilePath) ? true : false;
    
            /**
             * Server initialization
             * @type {EurecaServer}
             */
            this.server = new EurecaServer({
                authenticate: function(identifier: ClientIdentifier, next: Function){
                    try {
                        identifier.clientId = this.user.clientId; // Save socket clientId
                        identifier.ip = this.connection.remoteAddress.ip; // Save client ip
                    }
                    catch (e){
                        logger.server().error("Unable to get client info ", e);
                    }
    
                    __this.clients.push(identifier);
                    
                    // Save connect log
                    if (identifier.clientId != null && identifier.token != null && identifier.clientType == ClientType.Worker)
                        __this._saveWorkerLog(identifier, "workerStatus", "CONNECTED"); //Save to log
                    
                    next();
                },
                prefix: "nbfy",
                allow: ["task.launch", "task.stop", "task.status.get", "tunnel.create", "tunnel.stop", "tunnel.get", "onEvent"]
            });
            this.server.attach(webServer); // Attach express to eureca.io
    
            /**
             * Server internal events handling
             */
            this.server.on("unhandledMessage", function (msg: any) {
                logger.server().debug('Received message: ', msg);
            });
    
            this.server.onConnect(function(connection: any) {
               logger.server().debug('Client %s connected', connection.id);
            });
    
            this.server.onDisconnect(function (connection: any) {
                // Only for Workers
                __this.clients.filter(client => client.clientId == connection.id && client.clientType == ClientType.Worker).forEach(client => {
                    __this._saveWorkerLog(client, "workerStatus", "DISCONNECTED"); //Save to log

                    // Release identity
                    __this._releaseTaskIdentity(client);
                });

                // For all clients
                __this.clients = __this.clients.filter(client => client.clientId !== connection.id); //Remove client from clients
                logger.server().debug('Client %s disconnected', connection.id);
            });
    
            this.server.onError(function (e: any) {
                logger.server().error('An error occurred', e);
            });
    
            this._internalActions(this);
    
            /**
             * Print status with interval
             */
            if (typeof this.config.intervalPrintStatus != "undefined" && this.config.intervalPrintStatus > 0){
                setInterval(() => ServerStatus.printServerStatus(this), this.config.intervalPrintStatus * 1000);
            }
        }
        catch(e) {
            logger.server().error("Error while constructing server: " + e);
            process.exit(1);
        }
    }

    /**
     * Define all internal RPC methods callable from the clients
     * @param {Server} __this
     * @private
     */
    private _internalActions(__this: Server){
        /**
         * Automatic ping for all clients
         * @returns {number}
         */
        this.server.exports.ping = function(replyText: boolean = false) {
            __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                client.latestReceivedPingTimestamp = Date.now();
            });
            return replyText ? "pong" : 1;
        };

        /**
         * Actions for Task
         */
        this.server.exports.task = {
            /**
             * Launch a task on all workers or specified workers' client id
             * @param {TaskParameterList} parameters
             * @param token: Specific token filter
             * @param {object} args: Specific arguments
             */
            launch: function (parameters: TaskParameterList = {}, token: any = null, args: {force: boolean, limit: number, where: string}) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return

                __this._saveTaskParameters(parameters); //Save parameters

                let total = 0;
                let totalPromised = 0;
                let errors = 0;
                let success = 0;
                let limit = (typeof args.limit != "undefined") ? args.limit : 0; // Set limit for unlimited
                let whereKey: string;
                let whereFilter: string;

                // Process where
                if (args.where != null && args.where.includes("=")) {
                    let where: any = args.where.split("=");
                    whereKey = where[0].trim();
                    whereFilter = where[1].replace(/'/gi, "").trim(); // filter is surrounded with quotes involuntary by vorpal
                }

                __this.clients.filter(client => {
                    // Custom filter if token parameter is set and Worker
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                }).filter(client => {
                    // Process where
                    return (whereKey != null && whereFilter != null) ? client[whereKey] == whereFilter : true;
                }).forEach(client => { // Get Workers clients ONLY
                    if ((totalPromised < limit || limit == 0) && ((typeof args.force != "undefined" && args.force) || client.taskStatus == TaskStatus.Idle)) { // Launch task only if task is currently stopped and limit is set and not reached

                        // Check if getIdentity callback promise has been set
                        if (__this.identityCallback != null) {

                            // Get identity
                            clientPromises.push(promiseTimeout(30000, __this.identityCallback(client.token).then((identity: TaskIdentity) => { // timeout 10 sec

                                // Get clientIdentifier
                                let clientIdentifier: any = __this.clients.find(x => x.clientId == client.clientId);
                                if (typeof clientIdentifier !== "undefined")
                                    clientIdentifier.identity = identity; // Save identity for releasing

                                return __this.server.getClient(client.clientId).task.launch(identity, __this.taskParameters); // Launch task with identity
                            })).then(() => ++success)
                                .catch((err: any) => {
                                    //logger.server().error("Error while getting identity", err);
                                    ++errors; // Increments errors
                                }));
                        }

                        // No identity
                        else {
                            clientPromises.push(promiseTimeout(30000, __this.server.getClient(client.clientId).task.launch(null, __this.taskParameters)).then(() => ++success).catch((err: any) => {
                                //logger.server().error("Error while getting identity", err);
                                ++errors; // Increments errors
                            })); // Launch task without identity timeout 10 sec
                        }

                        ++totalPromised;
                    }

                    ++total;
                });

                Promise.all(clientPromises).catch((e: any) => { // Wait all launches to finish
                    logger.server().error("Unable to launch task", e);
                    ++errors; // Increments errors
                    return []; // Return a value allowing the .then to be called
                }).then(() => { // Send success anyway even if failed
                    context.return({
                        success: success,
                        total: total,
                        errors: errors
                    });
                });
            },
            /**
             * Stop a task on all workers or specified workers' client id
             * @param token: Specific token filter
             * @param {object} args: Specific arguments
             */
            stop: function (token: any = null, args: {force: boolean, limit: number, where: string}) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; // Define an asynchronous return

                let total = 0;
                let totalPromised = 0;
                let errors = 0;
                let limit = (typeof args.limit != "undefined") ? args.limit : 0; // Set limit for unlimited
                let whereKey: string;
                let whereFilter: string;

                // Process where
                if (args.where != null && args.where.includes("=")) {
                    let where: any = args.where.split("=");
                    whereKey = where[0].trim();
                    whereFilter = where[1].replace(/'/gi, "").trim(); // filter is surrounded with quotes involuntary by vorpal
                }

                __this.clients.filter(client => {
                    // Custom filter if token parameter is set
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                }).filter(client => {
                    // Process where
                    return (whereKey != null && whereFilter != null) ? client[whereKey] == whereFilter : true;
                }).forEach(client => { // Get Workers clients ONLY
                    if ((totalPromised < limit || limit == 0) && ((typeof args.force != "undefined" && args.force) || client.taskStatus != TaskStatus.Idle)){ // Stop task only if task is not currently stopped and limit is set and not reached
                        clientPromises.push(
                            promiseTimeout(30000, __this.server.getClient(client.clientId).task.stop()) // timeout 10 sec
                                .catch((e: any) => { // Catch directly error
                                    //logger.server().error("Unable to stop task ", e);
                                    ++errors; // Increments errors
                                })
                        ); // Stop task
                        ++totalPromised;
                    }

                    ++total;
                });

                Promise.all(clientPromises).catch((e: any) => { // Wait all stops to finish
                    logger.server().error("Unable to stop task ", e);
                    ++errors; // Increments errors
                    return []; // Return a value allowing the .then to be called
                }).then((results: any) => { // Send success anyway even if failed
                    context.return({
                        success: results.length,
                        total: total,
                        errors: errors
                    });
                });
            },
            /**
             * Action when a task has successfully been launch on the worker
             */
            onLaunched: function () {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Running;

                    __this.serverEvent.emit("taskEvent", "taskLaunched", null, client, workerProxy); // Emit event
                    __this._saveWorkerLog(client, "taskStatus", "LAUNCHED"); // Save to log
                });
            },
            /**
             * Action when a task has successfully been stop on the worker
             */
            onStopped: function () {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Idle;

                    __this.serverEvent.emit("taskEvent", "taskStopped", null, client, workerProxy); // Emit event
                    __this._saveWorkerLog(client, "taskStatus", "STOPPED"); // Save to log
                });
            },
            /**
             * Action when the worker task has found a result
             * Resend the result to all internal event subscribers
             * @param result
             */
            onResult: function(result: any) {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskResult", result, client, workerProxy); // Emit event

                    __this.events.sendEventToSubscribedCLIs("taskResult", result, client.token); // Send task event to subscribed CLIS
                    __this._saveWorkerResult(client, result); // Save to log
                });
            },
            /**
             * Action when the worker task failed
             * Resend the error to all internal event subscribers
             * @param error
             */
            onError: function(error: any) {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskError", error, client, workerProxy); // Emit event

                    client.taskStatus = TaskStatus.Error;
                    __this.events.sendEventToSubscribedCLIs("taskError", error, client.token); // Send task event to subscribed CLIS
                    __this._saveWorkerLog(client, "taskError", error); // Save to log
                });
            },
            /**
             * Action when a custom event is emitted from a worker task
             * Resend the event to all internal event subscribers
             * @param {string} eventName
             * @param data
             */
            onEvent: function(eventName: string, data: any = null){
                let workerProxy = this.clientProxy;

                //Save to log
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", eventName, data, client, workerProxy); // Emit event

                    __this.events.sendEventToSubscribedCLIs(eventName, data, client.token); // Send task event to subscribed CLIS
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            /**
             * Action when the task is ended
             * @param data
             */
            onEnded: function(data: any) {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskResult", data, client, workerProxy); // Emit event

                    client.taskStatus = TaskStatus.Ended;
                    let formattedData = (typeof data == "object") ? JSON.stringify(data) : data;
                    __this._saveWorkerLog(client, "taskStatus", `ENDED: ${formattedData}`); // Save to log
                    __this._releaseTaskIdentity(client);
                });
            },
            /**
             * Save a base64 encoded file from worker
             * @param {string} fileName
             * @param {string} extension
             * @param {string} buffer
             */
            b64Image: function(fileName: string, extension: string, buffer: string){
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this._saveWorkerB64Image(client, fileName, extension, buffer);
                    __this._saveWorkerLog(client, "taskStatus", "FILE: " + fileName + "." + extension); // Save to log
                });
            }
        };

        /**
         * Actions for Task Parameters
         */
        this.server.exports.task.parameters = {
            /**
             * Get the list of registered global parameters for all workers
             * @returns {TaskParameterList}
             */
            get: function() {
                return __this.taskParameters;
            },
            /**
             * Save the edited parameters values from CLI in local
             * @param {TaskParameterList} parameters
             */
            save: function(parameters: TaskParameterList = {}) {
                __this._saveTaskParameters(parameters); // Save parameters
            }
        };

        /**
         * Actions for Task Status
         */
        this.server.exports.task.status = {
            /**
             * Get status from all workers
             * @param token
             * @param {{where: string}} args
             */
            get: function (token: any = null, args: {where: string}){
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; // Define an asynchronous return

                let total = 0;
                let errors = 0;
                let success = 0;
                let statuses: any[] = [];
                let whereKey: string;
                let whereFilter: string;

                // Process where
                if (args.where != null && args.where.includes("=")) {
                    let where: any = args.where.split("=");
                    whereKey = where[0].trim();
                    whereFilter = where[1].replace(/'/gi, "").trim(); // filter is surrounded with quotes involuntary by vorpal
                }

                __this.clients.filter(client => {
                    // Custom filter if token parameter is set and Worker
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                }).filter(client => {
                    // Process where
                    return (whereKey != null && whereFilter != null) ? client[whereKey] == whereFilter : true;
                }).forEach(client => {
                    clientPromises.push(promiseTimeout(30000, __this.server.getClient(client.clientId).task.status.get()).then((status: any) => { // timeout 20 sec
                        if (status != null)
                            statuses.push(status);
                        ++success;
                    }).catch((err: any) => {
                        //logger.server().error("Error while getting worker status", err);
                        ++errors; // Increments errors
                    }));

                    ++total;
                });

                Promise.all(clientPromises).catch((e: any) => { // Wait all launches to finish
                    logger.server().error("Error while getting worker status", e);
                    ++errors; // Increments errors
                    return []; // Return a value allowing the .then to be called
                }).then(() => { // Send success anyway even if failed
                    context.return({
                        statuses: statuses,
                        success: success,
                        total: total,
                        errors: errors
                    });
                });
            }
        };

        /**
         * Action for Tunnel
         */
        this.server.exports.tunnel = {
            /**
             * Create a tunnel on the worker
             * @param token
             * @param localPort
             * @param isTcp
             */
            create: async function (token: string, localPort: number, isTcp: boolean = true) {
                let clientPromises: any[] = [];
                let results: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return

                if (!token)
                    return;

                __this.clients.filter(client => client.clientType == ClientType.Worker && client.token === token)
                    .forEach(client => {
                        clientPromises.push(promiseTimeout(30000, __this.server.getClient(client.clientId).tunnel.create(localPort, isTcp)).then((result: any) => { // timeout 30 sec
                            if (result != null)
                                results.push(result);
                        }).catch((err: any) => {
                            logger.server().error("Error while creating worker tunnel", err);
                        }));
                    });

                Promise.all(clientPromises).catch((e: any) => { // Wait all launches to finish
                    logger.server().error("Error while creating worker tunnel", e);
                    return []; // Return a value allowing the .then to be called
                }).then(() => { // Send success anyway even if failed
                    context.return(results);
                });
            },
            /**
             * Stop a tunnel on the worker
             * @param token
             * @param localPort
             */
            stop: async function(token: string, localPort: number, killAll: boolean = false) {
                let clientPromises: any[] = [];
                let success: number = 0;
                let context = this;
                context.async = true; //Define an asynchronous return

                __this.clients.filter(client => client.clientType == ClientType.Worker && client.token === token)
                    .forEach(client => {
                        // Stop send the number of succeed stops
                        clientPromises.push(promiseTimeout(30000, __this.server.getClient(client.clientId).tunnel.stop(localPort, killAll)).then((result: any) => { // timeout 30 sec
                            if (!isNaN(result))
                                success+=result;
                        }).catch((err: any) => {
                            logger.server().error("Error while stopping worker tunnel", err);
                        }));
                    });

                Promise.all(clientPromises).catch((e: any) => { // Wait all launches to finish
                    logger.server().error("Error while stopping worker tunnel", e);
                    return []; // Return a value allowing the .then to be called
                }).then(() => { // Send success anyway even if failed
                    context.return({
                        success: success
                    });
                });
            },
            /**
             * Get all tunnels created on the worker
             * @param workerToken
             */
            get: function (token: string) {
                let clientPromises: any[] = [];
                let results: any[] = [];

                //this.serverProxy is injected by eureca
                let context = this;
                context.async = true; //Define an asynchronous return

                if (!token)
                    return;

                __this.clients.filter(client => client.clientType == ClientType.Worker && client.token.startsWith(token))
                    .forEach(client => {
                        // Get send an array of tunnels so we need to concat it
                        clientPromises.push(promiseTimeout(10000,__this.server.getClient(client.clientId).tunnel.get()).then((data: any) => {
                            if (Array.isArray(data))
                                results = results.concat(data);
                        }).catch((err: any) => {
                            logger.server().error("Error while getting worker tunnel", err);
                        }));
                    });

                Promise.all(clientPromises).catch((err) => {
                    logger.server().error("Error while getting worker tunnels", err);
                    return []; // Return a value allowing the .then to be called
                }).then(() => { // Send success anyway even if failed
                    context.return(results);
                });
            },
            /**
             * Action when a custom event is emitted from a worker tunnel
             * Resend the event to all internal event subscribers
             * @param {string} eventName
             * @param data
             */
            onEvent: function(eventName: string, data: any = null){
                let workerProxy = this.clientProxy;

                //Save to log
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("tunnelEvent", eventName, data, client, workerProxy); // Emit event

                    __this.events.sendEventToSubscribedCLIs(eventName, data, client.token); //Send task event to subscribed CLIS
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            /**
             * Action when the worker tunnel failed
             * Resend the error to all internal event subscribers
             * @param error
             */
            onError: function(error: any) {
                let workerProxy = this.clientProxy;

                //Save to log
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("tunnelEvent", "tunnelError", error, client, workerProxy); // Emit event

                    __this.events.sendEventToSubscribedCLIs("tunnelError", error, client.token); //Send task event to subscribed CLIS
                    __this._saveWorkerLog(client, "tunnelError", error);
                });
            }
        };

        /**
         * Action for CLI clients
         */
        this.server.exports.cli = {
            /**
             * Subscribe the CLI to next worker events
             */
            subscribe: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => { //Get current client
                    if (__this.subscribedCLISToEvents.indexOf(client.token) === -1) //Check if cli token is not already in list
                        __this.subscribedCLISToEvents.push(client.token);
                });
            },
            /**
             * Remove the CLI to the worker events subscription
             */
            unsubscribe: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => { //Get current client
                    let index = __this.subscribedCLISToEvents.indexOf(client.token); //Find existing token
                    if (index !== -1) {
                        __this.subscribedCLISToEvents.splice(index, 1); //Remove item
                    }
                });
            },
            /**
             * Return the list of connected workers
             * @param token: Optional parameter to search by token
             * @returns {ClientIdentifier[]}
             */
            getWorkers: function(token: any = null) {
                return __this.clients.filter(client => {
                    //Custom filter if token parameter is set
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker)
                }).map(client => reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierWorkerKeys)); // Return restricted object
            },
            /**
             * Return worker currently used identities
             * @param token
             */
            getWorkersIdentities: function(token: any = null) {
                return __this.clients.filter(client => {
                    // Custom filter if token parameter is set and Worker
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                }).map(client => {
                    return Object.assign({
                        token: client.token
                    }, client.identity); // Merge with identity
                }); // Return restricted object
            },
            /**
             * Return the list of connected clis
             * @param token: Optional parameter to search by token
             * @returns {ClientIdentifier[]}
             */
            getCLIs: function(token: any = null) {
                return __this.clients.filter(client => {
                    //Custom filter if token parameter is set
                    return (token !== null) ? (client.clientType == ClientType.RemoteCLI && client.token.startsWith(token)) : (client.clientType == ClientType.RemoteCLI);
                }).map(client => reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierCLIKeys)); // Return restricted object
            },
            /**
             * Send a custom event to all connected workers or a specific one
             * @param {string} eventName
             * @param data
             * @param token specific token
             */
            sendEventToWorkers: function(eventName: string, data: any, token: any = null){
                return __this.events.sendEventToWorkers(eventName, data, token);
            }
        }
    }

    /**
     * Release identity af a worker
     * @param {ClientIdentifier} client
     * @private
     */
    private _releaseTaskIdentity(client: ClientIdentifier) {
        if (typeof this.identityCallback === "function" && typeof this.releaseIdentityCallback === "function" && typeof client.identity !== "undefined") {
            this.releaseIdentityCallback(client.identity, client.token).then(() => {
                client.identity = undefined; //Reset identity
            }).catch(() => logger.server().error("Unable to release identity for client %s", client.token));
        }
    }

    /**
     * Save the parameters for the next launch
     * @param {TaskParameterList} parameters
     * @private
     */
    private _saveTaskParameters(parameters: TaskParameterList = {}){
        //Treat input parameters
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                
                if (this.taskParameters.hasOwnProperty(parameter.key)) {
                    this.taskParameters[parameter.key] = parameter; //Update the local parameter
                }
            };
        }
    }

    /**
     * Save the worker event to log file
     * @param {ClientIdentifier} client
     * @param {string} eventName
     * @param data
     * @private
     */
    private _saveWorkerLog(client: ClientIdentifier, eventName: string, data: any){
        if (this.saveLogToDirectory && client.clientType == ClientType.Worker){
            let __this = this; //Keep context
            
            let castedData = (typeof data == "object") ? JSON.stringify(data) : data;
            let formatedData: string;
            let logPath: string;

            if (this.config.separateInstanceLogFiles) { // Each instances have a specific log file
                formatedData = "[" + (new Date).toISOString() + "] - [" + eventName.toUpperCase() + "] - " + castedData + "\n";
                logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + ".log.json"); //Log directory is /{groupId}/{instanceId}.{token}.log.json
            }
            else { // All instances of a group are in a unique log file
                formatedData = "[" + (new Date).toISOString() + "] - [" + client.instanceId.toUpperCase() + "][" + client.token + "] - [" + eventName.toUpperCase() + "] - " + castedData + "\n";
                logPath = path.join(this.config.logDirectoryPath, client.groupId, "log.json"); //Log directory is /{groupId}/log.json
            }

            function processErr(err: any){
                logger.server().error('Unable to save log: ', err);
                __this.events.sendEventToSubscribedCLIs("saveLogError", "Save log error " + err, client.token);
            }
            
            //Create directory if not exists and write to file
            fs.ensureFile(logPath).then(() => {
                fs.appendFile(logPath, formatedData).catch(processErr);
            }).catch(processErr);
        }
    }

    /**
     * Save the worker result to file
     * @param {ClientIdentifier} client
     * @param result
     * @private
     */
    private _saveWorkerResult(client: ClientIdentifier, result: any){
        if (this.saveResultToFile && client.clientType == ClientType.Worker){
            let __this = this; //Keep context
            
            let castedData = (typeof result == "object") ? JSON.stringify(result) : result;
            let formatedData = "[" + (new Date).toISOString() + "] - [" + client.token + "] - " + castedData + "\n";

            function processErr(err: any){
                logger.server().error('Unable to save result: ', err);
                __this.events.sendEventToSubscribedCLIs("saveResultError", "Save log result " + err, client.token);
            }
            
            //Create directory if not exists and write to file
            fs.ensureFile(this.config.resultFilePath).then(() => {
                fs.appendFile(this.config.resultFilePath, formatedData).catch(processErr);
            }).catch(processErr);
        }
    }
    
    /**
     * Save the worker base64 encoded image
     * @param {ClientIdentifier} client
     * @param {string} fileName
     * @param {string} extension
     * @param {string} buffer
     * @private
     */
    private _saveWorkerB64Image(client: ClientIdentifier, fileName: string, extension: string, buffer: string){
        if (this.saveLogToDirectory && client.clientType == ClientType.Worker){
            let __this = this; //Keep context
            
            let imagePath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + "." + fileName + "." + extension); //Log directory is /{groupId}/{instanceId}.{token}.{fileName}.{extension}
            
            function processErr(err: any){
                logger.server().error('Unable to save image: ', err);
                __this.events.sendEventToSubscribedCLIs("saveImageError", "Save image error " + err, client.token);
            }
            
            try {
                if (extension == "png")
                    buffer = buffer.replace(/^data:image\/png;base64,/,"");
                else if (extension == "jpg")
                    buffer = buffer.replace(/^data:image\/jpeg;base64,/,"");
                
                //Create directory if not exists and write to file
                fs.writeFile(imagePath, buffer, 'base64').catch(processErr);
            }
            catch(e){
                processErr(e);
            }
        }
        else
            logger.server().error('Image not saved: log directory not enabled');
    }

    /**
     * Launch the server
     */
    public connect(): void{
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
    }

    /**
     * Get the server logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.server();
    }

    /**
     * Public methods for Task control
     */
    public task = {
        /**
         * Add handler on task result event
         * @param {(result: any, client: any) => void} callback
         */
        onTaskResult: (callback: (result: any, identifier: ClientIdentifier, workerProxy: any) => void) => {
            this.serverEvent.on("taskEvent:taskResult", callback);
        },
        /**
         * Add handler on task custom event
         * @param {string} eventName
         * @param {(data: any, client: any) => void} callback
         */
        onTaskEvent: (eventName: string, callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void) => {
            this.serverEvent.on("taskEvent:" + eventName, callback);
        },
        /**
         * Add handler on task any event
         * @param {(eventName: string, data: any, identifier: ClientIdentifier, workerProxy: any) => void} callback
         */
        onTaskAnyEvent: (callback: (eventName: string, data: any, identifier: ClientIdentifier, workerProxy: any) => void) => {
            this.serverEvent.on("taskEvent", callback);
        },
        /**
         * Add handler on task end event
         * @param {(data: any, client: any) => void} callback
         */
        onTaskEnded: (callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void) => {
            this.serverEvent.on("taskEvent:taskEnded", callback);
        },
        /**
         * Add a custom task parameter for all workers
         * @param {string} key: The parameter key
         * @param defaultValue: Default initial value if value is not set
         * @param value: Initial value
         */
        addTaskParameter: (key: string, defaultValue: any, value: any = null) => {
            this.taskParameters[key] = (new TaskParameterItem(key, defaultValue, value));
        },
        /**
         * Get a particular parameter by key or false if not found
         * @param {string} key
         * @returns {TaskParameterItem<any>}
         */
        getTaskParameter: (key: string) => {
            if (this.taskParameters.hasOwnProperty(key)) {
                return this.taskParameters[key];
            }
            return false;
        },
        /**
         * Set a callback called when a worker is getting an identity
         * @param {GetIdentityCallback} callback
         */
        onTaskIdentityAcquired: (callback: GetIdentityCallback) => {
            this.identityCallback = callback;
        },
        /**
         * Set a callback called when a worker is releasing an identity
         * @param {ReleaseIdentityCallback} callback
         */
        onTaskIdentityReleased: (callback: ReleaseIdentityCallback) => {
            this.releaseIdentityCallback = callback;
        }
    };

    /**
     *  Public methods for events
     */
    public events = {
        /**
         * Forward a custom event to all the subscribed CLIs
         * @param {string} eventName: The name of the event
         * @param data: Optional parameters
         * @param {string} workerToken: The token of the origin worker
         * @public
         */
        sendEventToSubscribedCLIs: (eventName: string, data: any = null, workerToken: string) => {
            this.clients.filter(client => (client.clientType == ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
                .forEach(client => {
                    this.server.getClient(client.clientId).onEvent(eventName, data, workerToken); //Send event
                });
        },
        /**
         * Send a custom event to all connected workers or a specific one
         * @param {string} eventName
         * @param data
         * @param token specific token
         */
        sendEventToWorkers: (eventName: string, data: any, token: any = null) => {
            this.clients.filter(client => {
                // Custom filter if token parameter is set
                return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker)
            }).forEach(client => {
                this.server.getClient(client.clientId).onEvent(eventName, data); // Send event
            });
        }
    };

    /**
     * Public methods for server customization
     */
    public customize = {
        /**
         * Add custom server RPC method callable from clients
         * @param {string} name
         * @param {Function} callback
         */
        addServerAction: (name: string, callback: Function) => {
            this.server.exports[name] = callback;
        },
        /**
         * Declare a client RPC method callable from the server
         * @param {string} name
         */
        registerWorkerTask: (name: string) => {
            this.server.settings.allow.push(name);
        }
    };
}
