"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../logger");
const GlobalParameter_1 = require("../models/GlobalParameter");
const ServerStatus_1 = require("./ServerStatus");
const eureca_io_1 = require("eureca.io");
const express = require('express'), app = express(), webServer = require('http').createServer(app), EventEmitter = require("events"), fs = require('fs-extra'), path = require('path');
class Server {
    constructor(config = {}) {
        this.clients = [];
        this.config = {};
        this.globalParameters = {};
        this.subscribedCLISToEvents = [];
        this.saveLogToDirectory = false;
        this.saveResultToFile = false;
        this.filteredClientIdentifierCLIKeys = ["token", "ip", "groupId", "instanceId", "reconnect"];
        this.filteredClientIdentifierWorkerKeys = ["token", "ip", "groupId", "instanceId", "reconnect", "taskStatus"];
        try {
            this.config = config;
            let __this = this;
            this.serverEvent = new EventEmitter();
            if (config.logger)
                logger_1.logger.setServerLevel(config.logger);
            this.saveLogToDirectory = (config.logDirectoryPath) ? true : false;
            this.saveResultToFile = (config.resultFilePath) ? true : false;
            this.server = new eureca_io_1.Server({
                authenticate: function (identifier, next) {
                    try {
                        identifier.clientId = this.user.clientId;
                        identifier.ip = this.connection.remoteAddress.ip;
                    }
                    catch (e) {
                        logger_1.logger.server().error("Unable to get client info ", e);
                    }
                    __this.clients.push(identifier);
                    if (identifier.clientId != null && identifier.token != null && identifier.clientType == ClientIdentifier_1.ClientType.Worker)
                        __this._saveWorkerLog(identifier, "workerStatus", "CONNECTED");
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
            });
            this.server.onDisconnect(function (connection) {
                __this.clients.filter(client => client.clientId == connection.id && client.clientType == ClientIdentifier_1.ClientType.Worker).forEach(client => {
                    __this._saveWorkerLog(client, "workerStatus", "DISCONNECTED");
                    __this._releaseWorkerIdentity(client);
                });
                __this.clients = __this.clients.filter(client => client.clientId !== connection.id);
                logger_1.logger.server().debug('Client %s disconnected', connection.id);
            });
            this.server.onError(function (e) {
                logger_1.logger.server().error('An error occurred', e);
            });
            this._internalActions(this);
            if (typeof this.config.intervalPrintStatus != "undefined" && this.config.intervalPrintStatus != 0) {
                setInterval(() => ServerStatus_1.ServerStatus.printServerStatus(this), this.config.intervalPrintStatus * 1000);
            }
        }
        catch (e) {
            logger_1.logger.server().error("Error while constructing server: " + e);
            process.exit(1);
        }
    }
    _reduceObjectToAllowedKeys(object, keys) {
        return Object.keys(object)
            .filter(key => keys.includes(key))
            .reduce((obj, key) => {
            obj[key] = object[key];
            return obj;
        }, {});
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
                    __this._saveWorkerLog(client, "taskStatus", "LAUNCHED");
                });
            },
            taskStopped: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
                    __this._saveWorkerLog(client, "taskStatus", "STOPPED");
                });
            },
            taskStatus: function (log) {
            },
            taskResult: function (result) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskResult", result, client, workerProxy);
                    __this._sendEventToSubscribedCLIs("taskResult", result, client.token);
                    __this._saveWorkerResult(client, result);
                });
            },
            taskError: function (error) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskError", error, client, workerProxy);
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Error;
                    __this._sendEventToSubscribedCLIs("taskError", error, client.token);
                    __this._saveWorkerLog(client, "taskError", "STOPPED");
                });
            },
            taskEvent: function (eventName, data = null) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent:" + eventName, data, client, workerProxy);
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            taskEnded: function (data) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEnded", data, client, workerProxy);
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Ended;
                    __this._saveWorkerLog(client, "taskStatus", "ENDED: " + data);
                    __this._releaseWorkerIdentity(client);
                });
            },
            b64Image: function (fileName, extension, buffer) {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this._saveWorkerB64Image(client, fileName, extension, buffer);
                    __this._saveWorkerLog(client, "taskStatus", "FILE: " + fileName + "." + extension);
                });
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
                    if (__this.subscribedCLISToEvents.indexOf(client.token) === -1)
                        __this.subscribedCLISToEvents.push(client.token);
                });
            },
            unsubscribe: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    let index = __this.subscribedCLISToEvents.indexOf(client.token);
                    if (index !== -1) {
                        __this.subscribedCLISToEvents.splice(index, 1);
                    }
                });
            },
            getWorkers: function (token = null) {
                return __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).map(client => __this._reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierWorkerKeys));
            },
            getCLIs: function (token = null) {
                return __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI);
                }).map(client => __this._reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierCLIKeys));
            },
            getGlobalParameters: function () {
                return __this.globalParameters;
            },
            saveGlobalParameters: function (parameters = {}) {
                __this._saveTaskParameters(parameters);
            },
            launchTask: function (parameters = {}, token = null, args) {
                let clientPromises = [];
                let context = this;
                context.async = true;
                __this._saveTaskParameters(parameters);
                let total = 0;
                let totalPromised = 0;
                let errors = 0;
                let success = 0;
                let limit = (typeof args.limit != "undefined") ? args.limit : 0;
                let whereKey;
                let whereFilter;
                if (args.where != null && args.where.includes("=")) {
                    let where = args.where.split("=");
                    whereKey = where[0].trim();
                    whereFilter = where[1].replace(/'/gi, "").trim();
                }
                __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).filter(client => {
                    return (whereKey != null && whereFilter != null) ? client[whereKey] == whereFilter : true;
                }).forEach(client => {
                    if ((totalPromised < limit || limit == 0) && ((typeof args.force != "undefined" && args.force) || client.taskStatus == ClientIdentifier_1.TaskStatus.Idle)) {
                        if (__this.identityCallback != null) {
                            clientPromises.push(__this.identityCallback().then((identity) => {
                                let clientIdentifier = __this.clients.find(x => x.clientId == client.clientId);
                                if (typeof clientIdentifier !== "undefined")
                                    clientIdentifier.identity = identity;
                                return __this.server.getClient(client.clientId).launchTask(identity, __this.globalParameters).then(() => ++success);
                            }).catch((err) => {
                                logger_1.logger.server().error("Error while getting identity", err);
                                ++errors;
                            }));
                        }
                        else {
                            clientPromises.push(__this.server.getClient(client.clientId).launchTask(null, __this.globalParameters).then(() => ++success));
                        }
                        ++totalPromised;
                    }
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Unable to launch task", e);
                    ++errors;
                    return [];
                }).then((results) => {
                    context.return({
                        success: success,
                        total: total,
                        errors: errors
                    });
                });
            },
            stopTask: function (token = null, args) {
                let clientPromises = [];
                let context = this;
                context.async = true;
                let total = 0;
                let totalPromised = 0;
                let errors = 0;
                let limit = (typeof args.limit != "undefined") ? args.limit : 0;
                let whereKey;
                let whereFilter;
                if (args.where != null && args.where.includes("=")) {
                    let where = args.where.split("=");
                    whereKey = where[0].trim();
                    whereFilter = where[1].replace(/'/gi, "").trim();
                }
                __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).filter(client => {
                    return (whereKey != null && whereFilter != null) ? client[whereKey] == whereFilter : true;
                }).forEach(client => {
                    if ((totalPromised < limit || limit == 0) && ((typeof args.force != "undefined" && args.force) || client.taskStatus != ClientIdentifier_1.TaskStatus.Idle)) {
                        clientPromises.push(__this.server.getClient(client.clientId).stopTask()
                            .catch((e) => {
                            logger_1.logger.server().error("Unable to stop task ", e);
                            ++errors;
                        }));
                        ++totalPromised;
                    }
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Unable to stop task ", e);
                    ++errors;
                    return [];
                }).then((results) => {
                    context.return({
                        success: results.length,
                        total: total,
                        errors: errors
                    });
                });
            }
        };
    }
    _releaseWorkerIdentity(client) {
        if (typeof this.identityCallback === "function" && typeof this.releaseIdentityCallback === "function" && typeof client.identity !== "undefined") {
            this.releaseIdentityCallback(client.identity).then(() => {
                client.identity = undefined;
            }).catch(() => logger_1.logger.server().error("Unable to release identity for client %s", client.token));
        }
    }
    _sendEventToSubscribedCLIs(eventName, data = null, token) {
        this.clients.filter(client => (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1))
            .forEach(client => {
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, token);
        });
    }
    _saveTaskParameters(parameters = {}) {
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                if (this.globalParameters.hasOwnProperty(parameter.key)) {
                    this.globalParameters[parameter.key] = parameter;
                }
            }
            ;
        }
    }
    _saveWorkerLog(client, eventName, data) {
        if (this.saveLogToDirectory && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this;
            let castedData = (typeof data == "object") ? JSON.stringify(data) : data;
            let formatedData = "[" + (new Date).toISOString() + "] - " + "[" + eventName.toUpperCase() + "] - " + castedData + "\n";
            let logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + ".log.json");
            function processErr(err) {
                logger_1.logger.server().error('Unable to save log: ', err);
                __this._sendEventToSubscribedCLIs("saveLogError", "Save log error " + err, client.token);
            }
            fs.ensureFile(logPath).then(() => {
                fs.appendFile(logPath, formatedData).catch(processErr);
            }).catch(processErr);
        }
    }
    _saveWorkerResult(client, result) {
        if (this.saveResultToFile && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this;
            let castedData = (typeof result == "object") ? JSON.stringify(result) : result;
            let formatedData = "[" + (new Date).toISOString() + "] - " + "[" + client.token + "] - " + castedData + "\n";
            function processErr(err) {
                logger_1.logger.server().error('Unable to save result: ', err);
                __this._sendEventToSubscribedCLIs("saveResultError", "Save log result " + err, client.token);
            }
            fs.ensureFile(this.config.resultFilePath).then(() => {
                fs.appendFile(this.config.resultFilePath, formatedData).catch(processErr);
            }).catch(processErr);
        }
    }
    _saveWorkerB64Image(client, fileName, extension, buffer) {
        if (this.saveLogToDirectory && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this;
            let imagePath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + "." + fileName + "." + extension);
            function processErr(err) {
                logger_1.logger.server().error('Unable to save image: ', err);
                __this._sendEventToSubscribedCLIs("saveImageError", "Save image error " + err, client.token);
            }
            try {
                if (extension == "png")
                    buffer = buffer.replace(/^data:image\/png;base64,/, "");
                else if (extension == "jpg")
                    buffer = buffer.replace(/^data:image\/jpeg;base64,/, "");
                fs.writeFile(imagePath, buffer, 'base64').catch(processErr);
            }
            catch (e) {
                processErr(e);
            }
        }
        else
            logger_1.logger.server().error('Image not saved: log directory not enabled');
    }
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
    addGlobalParameter(key, defaultValue, value = null) {
        this.globalParameters[key] = (new GlobalParameter_1.GlobalParameter(key, defaultValue, value));
    }
    getGlobalParameter(key) {
        if (this.globalParameters.hasOwnProperty(key)) {
            return this.globalParameters[key];
        }
        return false;
    }
    addServerAction(name, callback) {
        this.server.exports[name] = callback;
    }
    declareWorkerTask(name) {
        this.server.settings.allow.push(name);
    }
    onWorkerGetIdentity(callback) {
        this.identityCallback = callback;
    }
    onWorkerReleaseIdentity(callback) {
        this.releaseIdentityCallback = callback;
    }
    logger() {
        return logger_1.logger.server();
    }
}
exports.Server = Server;
//# sourceMappingURL=Server.js.map