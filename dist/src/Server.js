"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const TaskParameter_1 = require("./TaskParameter");
const EurecaServer = require("eureca.io").Server;
const express = require('express'), app = express(), webServer = require('http').createServer(app), EventEmitter = require("events"), fs = require('fs-extra'), path = require('path');
class Server {
    constructor(config = {}) {
        this.clients = [];
        this.config = {};
        this.taskParameters = {}; //Save the parameters for the next task launch
        this.subscribedCLISToEvents = []; //Save the list of subscribed CLI
        this.saveLogToDirectory = false;
        this.saveResultToFile = false;
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
            authenticate: function (identifier, next) {
                try {
                    identifier.clientId = this.user.clientId; //Save socket clientId
                    identifier.ip = this.connection.remoteAddress.ip; //Save client ip
                }
                catch (e) {
                    logger_1.logger.server().error("Unable to get client info ", e);
                }
                __this.clients.push(identifier);
                next();
            },
            prefix: "nbfy",
            allow: ["launchTask", "stopTask", "statusTask", "CLIOnEvent"]
        });
        this.server.attach(webServer);
        /**
         * Server internal events handling
         */
        this.server.on("unhandledMessage", function (msg) {
            logger_1.logger.server().debug('Received message: ', msg);
        });
        this.server.onConnect(function (connection) {
            logger_1.logger.server().debug('Client %s connected', connection.id);
            let client = connection.clientProxy;
        });
        this.server.onDisconnect(function (connection) {
            __this.clients = __this.clients.filter(client => client.clientId !== connection.id); //Remove client from clients
            logger_1.logger.server().info('Client %s disconnected', connection.id);
        });
        this.server.onError(function (e) {
            logger_1.logger.server().error('an error occured', e);
        });
        this._internalActions(this);
    }
    /**
     * Define all internal RPC methods callable from the clients
     * @param {Server} __this
     * @private
     */
    _internalActions(__this) {
        /**
         * Automatic ping for all clients
         * @returns {number}
         */
        this.server.exports.ping = function () {
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
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Running;
                    __this._saveWorkerLog(client, "taskStatus", "LAUNCH"); //Save to log
                });
            },
            /**
             * Action when a task has successfully been stop on the worker
             */
            taskStopped: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
                    __this._saveWorkerLog(client, "taskStatus", "STOP"); //Save to log
                });
            },
            /**
             * Result of the status task call of a worker
             */
            taskStatus: function (log) {
                //TODO: implement
            },
            /**
             * Action when the worker task has found a result
             * Resend the result to all internal event subscribers
             * @param result
             */
            taskResult: function (result) {
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
            taskEvent: function (eventName, data = null) {
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
            taskEnded: function (data) {
                __this.serverEvent.emit("taskEnded", data, this.clientProxy); //TODO pass the client identifier
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
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
            ping: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
            /**
             * Subscribe the CLI to next worker events
             */
            subscribe: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    if (__this.subscribedCLISToEvents.indexOf(client.token) === -1) //Check if cli token is not already in list
                        __this.subscribedCLISToEvents.push(client.token);
                });
            },
            /**
             * Remove the CLI to the worker events subscription
             */
            unsubscribe: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
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
            getWorkers: function (clientId = null) {
                return __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                });
            },
            /**
             * Return the list of connected clis
             * @param clientId: Optional parameter to search by client id
             * @returns {ClientIdentifier[]}
             */
            getCLIs: function (clientId = null) {
                return __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && client.clientId.startsWith(clientId)) : (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI);
                });
            },
            /**
             * Get the list of registered task parameters
             * @returns {TaskParameterList}
             */
            getParameters: function () {
                return __this.taskParameters;
            },
            /**
             * Save the edited parameters values from CLI in local
             * @param {TaskParameterList} parameters
             */
            saveParameters: function (parameters = {}) {
                __this._saveTaskParameters(parameters); //Save parameters
            },
            /**
             * Launch a task on all workers or specified workers' client id
             * @param {TaskParameterList} parameters
             * @param clientId
             * @param {boolean} forceLaunch: Launch task even if the task status is already launched
             */
            launchTask: function (parameters = {}, clientId = null, forceLaunch = false) {
                let clientPromises = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                __this._saveTaskParameters(parameters); //Save parameters
                let total = 0;
                __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).forEach(client => {
                    if (forceLaunch || client.taskStatus != ClientIdentifier_1.TaskStatus.Running) { // Launch task only if task is not currently running
                        clientPromises.push(__this.server.getClient(client.clientId).launchTask(__this.taskParameters)); //Launch task
                    }
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Unable to launch task ", e);
                    //TODO Send error to CLI
                }).then((results) => {
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
            stopTask: function (clientId = null, forceStop = false) {
                let clientPromises = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                let total = 0;
                __this.clients.filter(client => {
                    //Custom filter if clientId parameter is set
                    return (clientId !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.clientId.startsWith(clientId)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).forEach(client => {
                    if (forceStop || client.taskStatus != ClientIdentifier_1.TaskStatus.Idle) { // Stop task only if task is not currently stopped
                        clientPromises.push(__this.server.getClient(client.clientId).stopTask()); //Stop task
                    }
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Unable to stop task ", e);
                    //TODO Send error to CLI
                }).then((results) => {
                    context.return({
                        success: results.length,
                        total: total
                    });
                });
            }
        };
    }
    /**
     * Forward an event to all the subscribed CLIs
     * @param {string} eventName: The name of the event
     * @param data: Optional parameters
     * @param {string} clientId: The clientId of the origin worker
     * @private
     */
    _sendEventToSubscribedCLIs(eventName, data = null, clientId) {
        this.clients.filter(client => (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
            .forEach(client => {
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, clientId); //Send event
        });
    }
    /**
     * Save the parameters for the next launch
     * @param {TaskParameterList} parameters
     * @private
     */
    _saveTaskParameters(parameters = {}) {
        //Treat input parameters
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                if (this.taskParameters.hasOwnProperty(parameter.key)) {
                    this.taskParameters[parameter.key] = parameter; //Update the local parameter
                }
            }
            ;
        }
    }
    /**
     * Save the worker event to log file
     * @param {ClientIdentifier} client
     * @param {string} eventName
     * @param data
     * @private
     */
    _saveWorkerLog(client, eventName, data) {
        if (this.saveLogToDirectory && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this; //Keep context
            let castedData = (typeof data == "object") ? JSON.stringify(data) : data;
            let formatedData = "[" + (new Date).toISOString() + "] - " + castedData + "\n";
            let logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + eventName + '.json'); //Log directory is /{groupId}/{instanceId}.{eventType.json}
            function processErr(err) {
                logger_1.logger.server().error('Unable to save log: ', err);
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
    _saveWorkerResult(client, result) {
        if (this.saveResultToFile && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this; //Keep context
            let castedData = (typeof result == "object") ? JSON.stringify(result) : result;
            let formatedData = "[" + (new Date).toISOString() + "] - " + castedData + "\n";
            function processErr(err) {
                logger_1.logger.server().error('Unable to save result: ', err);
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
    connect() {
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
    }
    /**
     * Add handler on task result event
     * @param {(result: any, client: any) => void} callback
     */
    onTaskResult(callback) {
        this.serverEvent.on("taskResult", callback);
    }
    /**
     * Add handler on task custom event
     * @param {string} eventName
     * @param {(data: any, client: any) => void} callback
     */
    onTaskEvent(eventName, callback) {
        this.serverEvent.on("taskEvent:" + eventName, callback);
    }
    /**
     * Add handler on task end event
     * @param {(data: any, client: any) => void} callback
     */
    onTaskEnded(callback) {
        this.serverEvent.on("taskEnded", callback);
    }
    /**
     * Add a custom task parameter
     * @param {string} key: The parameter key
     * @param defaultValue: Default initial value if value is not set
     * @param value: Initial value
     */
    addTaskParameter(key, defaultValue, value = null) {
        this.taskParameters[key] = (new TaskParameter_1.TaskParameter(key, defaultValue, value));
    }
    /**
     * Add custom server RPC method callable from clients
     * @param {string} name
     * @param {Function} callback
     */
    addServerAction(name, callback) {
        this.server.exports[name] = callback;
    }
    /**
     * Declare a client RPC method callable from the server
     * @param {string} name
     */
    addWorkerTask(name) {
        this.server.settings.allow.push(name);
    }
}
exports.Server = Server;
//# sourceMappingURL=Server.js.map