import {ClientIdentifier, ClientType, TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../logger";
import {GlobalParameter, GlobalParameterList} from "../models/GlobalParameter";
import {ServerConfig} from "../models/ServerConfig";
import {ServerStatus} from './ServerStatus';
import { Server as EurecaServer } from 'eureca.io';
import {GetIdentityCallback, ReleaseIdentityCallback, WorkerIdentity} from "../models/WorkerIdentity";
import {Logger} from "log4js";

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
    private globalParameters: GlobalParameterList = {}; //Save the parameters for the next task launch
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
                allow: ["launchTask", "stopTask", "statusTask", "CLIOnEvent"]
            });
            this.server.attach(webServer);
    
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
                    __this._releaseWorkerIdentity(client);
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
            if (typeof this.config.intervalPrintStatus != "undefined" && this.config.intervalPrintStatus != 0){
                setInterval(() => ServerStatus.printServerStatus(this), this.config.intervalPrintStatus * 1000);
            }
        }
        catch(e) {
            logger.server().error("Error while constructing server: " + e);
            process.exit(1);
        }
    }

    /**
     * Reduce an object properties to a certain list of allowed keys
     * @param object
     * @param {Array<String>} keys
     * @returns {Object}
     * @private
     */
    private _reduceObjectToAllowedKeys(object: any, keys: any): Object {
        return Object.keys(object)
            .filter(key => keys.includes(key))
            .reduce((obj: any, key: any) => {
                obj[key] = object[key];
                return obj;
            }, {});
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
        this.server.exports.ping = function() {
            __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                client.latestReceivedPingTimestamp = Date.now();
            });
            return 1;
        };

        /**
         * Methods definition for Worker clients
         */
        this.server.exports.task = {
            /**
             * Action when a task has successfully been launch on the worker
             */
            taskLaunched: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Running;
                    __this._saveWorkerLog(client, "taskStatus", "LAUNCHED"); //Save to log
                });
            },
            /**
             * Action when a task has successfully been stop on the worker
             */
            taskStopped: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Idle;
                    __this._saveWorkerLog(client, "taskStatus", "STOPPED"); //Save to log
                });
            },
            /**
             * Result of the status task call of a worker
             */
            taskStatus: function (log: any) {
                //TODO: implement
            },
            /**
             * Action when the worker task has found a result
             * Resend the result to all internal event subscribers
             * @param result
             */
            taskResult: function(result: any) {
                let workerProxy = this.clientProxy;


                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskResult", result, client, workerProxy);

                    __this._sendEventToSubscribedCLIs("taskResult", result, client.token); //Send task event to subscribed CLIS
                    __this._saveWorkerResult(client, result); //Save to log
                });

            },
            /**
             * Action when a custom event is emitted from a worker task
             * Resend the event to all internal event subscribers
             * @param {string} eventName
             * @param data
             */
            taskEvent: function(eventName: string, data: any = null){
                let workerProxy = this.clientProxy;

                //Save to log
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent:" + eventName, data, client, workerProxy);

                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            /**
             * Action when the task is ended
             * @param data
             */
            taskEnded: function(data: any) {
                let workerProxy = this.clientProxy;

                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEnded", data, client, workerProxy);

                    client.taskStatus = TaskStatus.Idle;
                    __this._saveWorkerLog(client, "taskStatus", "ENDED: " + data); //Save to log
                    __this._releaseWorkerIdentity(client);
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
                    __this._saveWorkerLog(client, "taskStatus", "FILE: " + fileName + "." + extension); //Save to log
                });
            }
        };

        /**
         * Methods definition for CLI clients
         */
        this.server.exports.cli = {
            /**
             * Reply to a ping command from CLI
             * @returns {string}
             */
            ping: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                   client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
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
                }).map(client => __this._reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierWorkerKeys)); // Return restricted object
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
                }).map(client => __this._reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierCLIKeys)); // Return restricted object
            },
            /**
             * Get the list of registered global parameters for all workers
             * @returns {GlobalParameterList}
             */
            getGlobalParameters: function() {
                return __this.globalParameters;
            },
            /**
             * Save the edited parameters values from CLI in local
             * @param {GlobalParameterList} parameters
             */
            saveGlobalParameters: function(parameters: GlobalParameterList = {}) {
                __this._saveTaskParameters(parameters); //Save parameters
            },
            /**
             * Launch a task on all workers or specified workers' client id
             * @param {GlobalParameterList} parameters
             * @param token: Specific token filter
             * @param {boolean} forceLaunch: Launch task even if the task status is already launched
             */
            launchTask: function (parameters: GlobalParameterList = {}, token: any = null, forceLaunch: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return

                __this._saveTaskParameters(parameters); //Save parameters

                let total = 0;
                let errors = 0;
                let success = 0;

                __this.clients.filter(client => {
                        // Custom filter if token parameter is set and Worker
                    return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                }).forEach(client => { // Get Workers clients ONLY
                    if (forceLaunch || client.taskStatus != TaskStatus.Running) { // Launch task only if task is not currently running

                        // Check if getIdentity callback promise has been set
                        if (__this.identityCallback != null) {

                            // Get identity
                            clientPromises.push(__this.identityCallback().then((identity: WorkerIdentity) => {

                                // Get clientIdentifier
                                let clientIdentifier: any = __this.clients.find(x => x.clientId == client.clientId);
                                if (typeof clientIdentifier !== "undefined")
                                    clientIdentifier.identity = identity; // Save identity for releasing

                                return __this.server.getClient(client.clientId).launchTask(identity, __this.globalParameters).then(() => ++success); // Launch task with identity
                            }).catch((err: any) => {
                                logger.server().error("Error while getting identity", err);
                                ++errors; // Increments errors
                            }));
                        }

                        // No identity
                        else {
                            clientPromises.push(__this.server.getClient(client.clientId).launchTask(null, __this.globalParameters).then(() => ++success)); // Launch task without identity
                        }
                    }

                    ++total;
                });

                Promise.all(clientPromises).catch((e: any) => { // Wait all launches to finish
                    logger.server().error("Unable to launch task", e);
                    ++errors; // Increments errors
                    return []; // Return a value allowing the .then to be called
                }).then((results: any) => { // Send success anyway even if failed
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
             * @param {boolean} forceStop: Stop the task even if the task status is already stopped
             */
            stopTask: function (token: any = null, forceStop: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; // Define an asynchronous return

                let total = 0;
                let errors = 0;

                __this.clients.filter(client => {
                        // Custom filter if token parameter is set
                        return (token !== null) ? (client.clientType == ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientType.Worker);
                    }).forEach(client => { // Get Workers clients ONLY
                        if (forceStop || client.taskStatus != TaskStatus.Idle) { // Stop task only if task is not currently stopped
                            clientPromises.push(
                                __this.server.getClient(client.clientId).stopTask()
                                    .catch((e: any) => { // Catch directly error
                                        logger.server().error("Unable to stop task ", e);
                                        ++errors; // Increments errors
                                    })
                            ); //Stop task
                        }

                    ++total;
                });

                Promise.all(clientPromises).catch((e: any) => { //Wait all stops to finish
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
            }
        }
    }

    /**
     * Release identity af a worker
     * @param {ClientIdentifier} client
     * @private
     */
    private _releaseWorkerIdentity(client: ClientIdentifier) {
        if (typeof this.identityCallback === "function" && typeof this.releaseIdentityCallback === "function" && typeof client.identity !== "undefined") {
            this.releaseIdentityCallback(client.identity).then(() => {
                client.identity = undefined; //Reset identity
            }).catch(() => logger.server().error("Unable to release identity for client %s", client.token));
        }
    }

    /**
     * Forward an event to all the subscribed CLIs
     * @param {string} eventName: The name of the event
     * @param data: Optional parameters
     * @param {string} token: The token of the origin worker
     * @private
     */
    private _sendEventToSubscribedCLIs(eventName: string, data: any = null, token: string){
        this.clients.filter(client => (client.clientType == ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
                    .forEach(client => { 
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, token); //Send event
        });
    }

    /**
     * Save the parameters for the next launch
     * @param {GlobalParameterList} parameters
     * @private
     */
    private _saveTaskParameters(parameters: GlobalParameterList = {}){
        //Treat input parameters
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                
                if (this.globalParameters.hasOwnProperty(parameter.key)) {
                    this.globalParameters[parameter.key] = parameter; //Update the local parameter
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
            let formatedData = "[" + (new Date).toISOString() + "] - " + "[" + eventName.toUpperCase() + "] - " + castedData + "\n";
            let logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + ".log.json"); //Log directory is /{groupId}/{instanceId}.{token}.log.json
            
            function processErr(err: any){
                logger.server().error('Unable to save log: ', err);
                __this._sendEventToSubscribedCLIs("saveLogError", "Save log error " + err, client.token);
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
            let formatedData = "[" + (new Date).toISOString() + "] - " + "[" + client.token + "] - " + castedData + "\n";

            function processErr(err: any){
                logger.server().error('Unable to save result: ', err);
                __this._sendEventToSubscribedCLIs("saveResultError", "Save log result " + err, client.token);
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
                __this._sendEventToSubscribedCLIs("saveImageError", "Save image error " + err, client.token);
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
     * Add handler on task result event
     * @param {(result: any, client: any) => void} callback
     */
    public onTaskResult(callback: (result: any, identifier: ClientIdentifier, workerProxy: any) => void){
        this.serverEvent.on("taskResult", callback);
    }

    /**
     * Add handler on task custom event
     * @param {string} eventName
     * @param {(data: any, client: any) => void} callback
     */
    public onTaskEvent(eventName: string, callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void){
        this.serverEvent.on("taskEvent:" + eventName, callback);
    }

    /**
     * Add handler on task end event
     * @param {(data: any, client: any) => void} callback
     */
    public onTaskEnded(callback: (data: any, identifier: ClientIdentifier, workerProxy: any) => void){
        this.serverEvent.on("taskEnded", callback);
    }

    /**
     * Add a custom task parameter for all workers
     * @param {string} key: The parameter key
     * @param defaultValue: Default initial value if value is not set
     * @param value: Initial value
     */
    public addGlobalParameter(key: string, defaultValue: any, value: any = null){
        this.globalParameters[key] = (new GlobalParameter(key, defaultValue, value));
    }

    /**
     * Get a particular parameter by key
     * @param {string} key
     * @returns {GlobalParameter<any> | false}
     */
    public getGlobalParameter(key: string){
        if (this.globalParameters.hasOwnProperty(key)) {
            return this.globalParameters[key];
        }
        return false;
    }

    /**
     * Add custom server RPC method callable from clients
     * @param {string} name
     * @param {Function} callback
     */
    public addServerAction(name: string, callback: Function){
        this.server.exports[name] = callback;
    }

    /**
     * Declare a client RPC method callable from the server
     * @param {string} name
     */
    public declareWorkerTask(name: string){
        this.server.settings.allow.push(name);
    }

    /**
     * Set a callback called when a worker is getting an identity
     * @param {GetIdentityCallback} callback
     */
    public onWorkerGetIdentity(callback: GetIdentityCallback){
        this.identityCallback = callback;
    }

    /**
     * Set a callback called when a worker is releasing an identity
     * @param {ReleaseIdentityCallback} callback
     */
    public onWorkerReleaseIdentity(callback: ReleaseIdentityCallback){
        this.releaseIdentityCallback = callback;
    }

    /**
     * Get the server logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.server();
    }
}
