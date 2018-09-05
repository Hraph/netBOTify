"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const TaskParameter_1 = require("./TaskParameter");
const EurecaServer = require("eureca.io").Server;
const express = require('express'), app = express(), webServer = require('http').createServer(app), EventEmitter = require("events");
class Server {
    constructor(config = {}) {
        this.clients = [];
        this.config = {};
        this.taskParameters = {}; //Save the parameters for the next task launch
        this.subscribedCLISToEvents = []; //Save the list of subscribed CLI
        this.config = config;
        let __this = this; //Keep context
        this.serverEvent = new EventEmitter();
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
    _internalActions(__this) {
        this.server.exports.ping = function () {
            __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                client.latestReceivedPingTimestamp = Date.now();
            });
            return 1;
        };
        this.server.exports.task = {
            taskLaunched: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Running;
                });
            },
            taskStopped: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
                });
            },
            taskStatus: function (log) {
                //TODO: implement
            },
            taskResult: function (result) {
                __this.serverEvent.emit("taskResult", result, this.clientProxy);
                __this._sendEventToSubscribedCLIs("taskResult", result, this.user.clientId); //Send task event to subscribed CLIS
            },
            taskEvent: function (eventName, data = null) {
                __this.serverEvent.emit("taskEvent:" + eventName, data);
            },
            taskEnded: function (data) {
                __this.serverEvent.emit("taskEnded", data, this.clientProxy); //TODO pass the client identifier
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
                });
                __this._sendEventToSubscribedCLIs("taskEnded", data, this.user.clientId); //Send task event to subscribed CLIS
            }
        };
        this.server.exports.cli = {
            ping: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
            subscribe: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    if (__this.subscribedCLISToEvents.indexOf(client.token) === -1) //Check if cli token is not already in list
                        __this.subscribedCLISToEvents.push(client.token);
                });
            },
            unsubscribe: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    var index = __this.subscribedCLISToEvents.indexOf(client.token); //Find existing token
                    if (index !== -1) {
                        __this.subscribedCLISToEvents.splice(index, 1); //Remove item
                    }
                });
            },
            getWorkers: function () {
                return __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker);
            },
            getCLIs: function () {
                return __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.RemoteCLI);
            },
            getParameters: function () {
                return __this.taskParameters;
            },
            saveParameters: function (parameters = {}) {
                __this._saveTaskParameters(parameters); //Save parameters
            },
            launchTask: function (parameters = {}, forceLaunch = false) {
                let clientPromises = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                __this._saveTaskParameters(parameters); //Save parameters
                let total = 0;
                __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker).forEach(client => {
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
            stopTask: function (forceStop = false) {
                let clientPromises = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                let total = 0;
                __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker).forEach(client => {
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
    _sendEventToSubscribedCLIs(eventName, data = null, clientId) {
        this.clients.filter(client => (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
            .forEach(client => {
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, clientId); //Send event
        });
    }
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
     * Launch server
     */
    connect() {
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
    }
    onTaskResult(callback) {
        this.serverEvent.on("taskResult", callback);
    }
    onTaskEvent(eventName, callback) {
        this.serverEvent.on("taskEvent:" + eventName, callback);
    }
    onTaskEnded(callback) {
        this.serverEvent.on("taskEnded", callback);
    }
    addTaskParameter(key, defaultValue, value = null) {
        this.taskParameters[key] = (new TaskParameter_1.TaskParameter(key, defaultValue, value));
    }
    addServerAction(name, callback) {
        this.server.exports[name] = callback;
    }
    addWorkerTask(name) {
        this.server.settings.allow.push(name);
    }
}
exports.Server = Server;
//# sourceMappingURL=Server.js.map