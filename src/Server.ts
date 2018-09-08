import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";
import {logger} from "./logger";
import {TaskParameter, TaskParameterList} from "./TaskParameter";

const EurecaServer = require("eureca.io").Server;
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
    private config: any = {};
    private server: any;
    private taskParameters: TaskParameterList = {}; //Save the parameters for the next task launch
    private serverEvent: any;
    private subscribedCLISToEvents: string[] = []; //Save the list of subscribed CLI
    private saveLogToDirectory: boolean = false;
    private saveResultToFile: boolean = false;

    constructor(config: any = {}){
        this.config = config;
        let __this = this; //Keep context
        this.serverEvent = new EventEmitter();

        /**
         * Process config
         */
        this.saveLogToDirectory = (config.logDirectoryPath) ? true : false;
        this.saveResultToFile = (config.resultFilePath) ? true : false;

        /**
         * Server initialization
         * @type {Eureca.Server}
         */
        this.server = new EurecaServer({
            authenticate: function(identifier: ClientIdentifier, next: Function){
                try {
                    identifier.clientId = this.user.clientId; //Save socket clientId
                    identifier.ip = this.connection.remoteAddress.ip;//Save client ip
                }
                catch (e){
                    logger.server().error("Unable to get client info ", e);
                }

                __this.clients.push(identifier);
                
                //Save connect log
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
            __this.clients.filter(client => client.clientId == connection.id && client.clientType == ClientType.Worker).forEach(client => {
                __this._saveWorkerLog(client, "workerStatus", "DISCONNECTED"); //Save to log
            });
            
            __this.clients = __this.clients.filter(client => client.clientId !== connection.id); //Remove client from clients
            logger.server().info('Client %s disconnected', connection.id);
        });

        this.server.onError(function (e: any) {
            logger.server().error('an error occured', e);
        });

        this._internalActions(this);
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
                __this.serverEvent.emit("taskResult", result, this.clientProxy);
                
                //Send to clis
                __this._sendEventToSubscribedCLIs("taskResult", result, this.user.clientId); //Send task event to subscribed CLIS
                
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
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
                __this.serverEvent.emit("taskEvent:" + eventName, data);  
                
                //Save to log
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            /**
             * Action when the task is ended
             * @param data
             */
            taskEnded: function(data: any) {
                __this.serverEvent.emit("taskEnded", data, this.clientProxy); //TODO pass the client identifier
                
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Idle;
                    __this._saveWorkerLog(client, "taskStatus", "ENDED: " + data); //Save to log
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
             * @param clientId: Optional parameter to search by client id
             * @returns {ClientIdentifier[]}
             */
            getWorkers: function(clientId: any = null) {
                return __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientType.Worker);
                });
            },
            /**
             * Return the list of connected clis
             * @param clientId: Optional parameter to search by client id
             * @returns {ClientIdentifier[]}
             */
            getCLIs: function(clientId: any = null) {
                return __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientType.RemoteCLI && client.clientId.startsWith(clientId)) : (client.clientType == ClientType.RemoteCLI);
                });
            },
            /**
             * Get the list of registered task parameters
             * @returns {TaskParameterList}
             */
            getParameters: function() {
                return __this.taskParameters;
            },
            /**
             * Save the edited parameters values from CLI in local
             * @param {TaskParameterList} parameters
             */
            saveParameters: function(parameters: TaskParameterList = {}) {
                __this._saveTaskParameters(parameters); //Save parameters
            },
            /**
             * Launch a task on all workers or specified workers' client id
             * @param {TaskParameterList} parameters
             * @param clientId
             * @param {boolean} forceLaunch: Launch task even if the task status is already launched
             */
            launchTask: function (parameters: TaskParameterList = {}, clientId: any = null, forceLaunch: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                
                __this._saveTaskParameters(parameters); //Save parameters
                
                let total = 0;
                
                __this.clients.filter(client => {
                        //Custom filter if clientId parameter is set
                        return (clientId !== null) ? (client.clientType == ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientType.Worker);
                    }).forEach(client => { // Get Workers clients ONLY
                        if (forceLaunch || client.taskStatus != TaskStatus.Running) { // Launch task only if task is not currently running
                            clientPromises.push(__this.server.getClient(client.clientId).launchTask(__this.taskParameters)); //Launch task
                    }
                    
                    ++total;
                });
                
                Promise.all(clientPromises).catch((e: any) => { //Wait all launches to finish
                    logger.server().error("Unable to launch task ", e);
                    //TODO Send error to CLI
                }).then((results: any) => {
                    context.return({
                        success: results.length,
                        total: total
                    });
                });
            },
            /**
             * Stop a task on all workers or specified workers' client id
             * @param clientId
             * @param {boolean} forceStop: Stop the task even if the task status is already stopped
             */
            stopTask: function (clientId: any = null, forceStop: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                
                let total = 0;
                
                __this.clients.filter(client => {
                        //Custom filter if clientId parameter is set
                        return (clientId !== null) ? (client.clientType == ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientType.Worker);
                    }).forEach(client => { // Get Workers clients ONLY
                        if (forceStop || client.taskStatus != TaskStatus.Idle) { // Stop task only if task is not currently stopped
                            clientPromises.push(__this.server.getClient(client.clientId).stopTask()); //Stop task
                    }
                    
                    ++total;
                });
                
                Promise.all(clientPromises).catch((e: any) => { //Wait all stops to finish
                    logger.server().error("Unable to stop task ", e);
                    //TODO Send error to CLI
                }).then((results: any) => {
                    context.return({
                        success: results.length,
                        total: total
                    });
                });
            }
        }
    }

    /**
     * Forward an event to all the subscribed CLIs
     * @param {string} eventName: The name of the event
     * @param data: Optional parameters
     * @param {string} clientId: The clientId of the origin worker
     * @private
     */
    private _sendEventToSubscribedCLIs(eventName: string, data: any = null, clientId: string){
        this.clients.filter(client => (client.clientType == ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
                    .forEach(client => { 
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, clientId); //Send event
        });
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
            let formatedData = "[" + (new Date).toISOString() + "] - " + "[" + eventName.toUpperCase() + "] - " + castedData + "\n";
            let logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + ".log.json"); //Log directory is /{groupId}/{instanceId}.{token}.log.json
            
            function processErr(err: any){
                logger.server().error('Unable to save log: ', err);
                __this._sendEventToSubscribedCLIs("saveLogError", "Save log error " + err, client.clientId);
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
                __this._sendEventToSubscribedCLIs("saveResultError", "Save log result " + err, client.clientId);
            }
            
            //Create directory if not exists and write to file
            fs.ensureFile(this.config.resultFilePath).then(() => {
                fs.appendFile(this.config.resultFilePath, formatedData).catch(processErr);
            }).catch(processErr);
        }
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
    public onTaskResult(callback: (result: any, client: any) => void){
        this.serverEvent.on("taskResult", callback);
    }

    /**
     * Add handler on task custom event
     * @param {string} eventName
     * @param {(data: any, client: any) => void} callback
     */
    public onTaskEvent(eventName: string, callback: (data: any, client: any) => void){
        this.serverEvent.on("taskEvent:" + eventName, callback);
    }

    /**
     * Add handler on task end event
     * @param {(data: any, client: any) => void} callback
     */
    public onTaskEnded(callback: (data: any, client: any) => void){
        this.serverEvent.on("taskEnded", callback);
    }

    /**
     * Add a custom task parameter
     * @param {string} key: The parameter key
     * @param defaultValue: Default initial value if value is not set
     * @param value: Initial value
     */
    public addTaskParameter(key: string, defaultValue: any, value: any = null){
        this.taskParameters[key] = (new TaskParameter(key, defaultValue, value));
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
    public addWorkerTask(name: string){
        this.server.settings.allow.push(name);
    }
}
