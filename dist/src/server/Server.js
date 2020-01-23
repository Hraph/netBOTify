"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../utils/logger");
const TaskParameters_1 = require("../models/TaskParameters");
const ServerStatus_1 = require("./ServerStatus");
const eureca_io_1 = require("eureca.io");
const utils_1 = require("../utils/utils");
const express = require('express'), app = express(), webServer = require('http').createServer(app), EventEmitter = require("events"), fs = require('fs-extra'), path = require('path');
class Server {
    constructor(config = {}) {
        this.clients = [];
        this.config = {};
        this.taskParameters = {};
        this.subscribedCLISToEvents = [];
        this.saveLogToDirectory = false;
        this.saveResultToFile = false;
        this.filteredClientIdentifierCLIKeys = ["token", "ip", "groupId", "instanceId", "reconnect"];
        this.filteredClientIdentifierWorkerKeys = ["token", "ip", "groupId", "instanceId", "reconnect", "taskStatus"];
        this.task = {
            onTaskResult: (callback) => {
                this.serverEvent.on("taskEvent:taskResult", callback);
            },
            onTaskEvent: (eventName, callback) => {
                this.serverEvent.on("taskEvent:" + eventName, callback);
            },
            onTaskAnyEvent: (callback) => {
                this.serverEvent.on("taskEvent", callback);
            },
            onTaskEnded: (callback) => {
                this.serverEvent.on("taskEvent:taskEnded", callback);
            },
            addTaskParameter: (key, defaultValue, value = null) => {
                this.taskParameters[key] = (new TaskParameters_1.TaskParameterItem(key, defaultValue, value));
            },
            getTaskParameter: (key) => {
                if (this.taskParameters.hasOwnProperty(key)) {
                    return this.taskParameters[key];
                }
                return false;
            },
            onTaskIdentityAcquired: (callback) => {
                this.identityCallback = callback;
            },
            onTaskIdentityReleased: (callback) => {
                this.releaseIdentityCallback = callback;
            }
        };
        this.events = {
            sendEventToSubscribedCLIs: (eventName, data = null, workerToken) => {
                this.clients.filter(client => (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1))
                    .forEach(client => {
                    this.server.getClient(client.clientId).onEvent(eventName, data, workerToken);
                });
            },
            sendEventToWorkers: (eventName, data, token = null) => {
                this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).forEach(client => {
                    this.server.getClient(client.clientId).onEvent(eventName, data);
                });
            }
        };
        this.customize = {
            addServerAction: (name, callback) => {
                this.server.exports[name] = callback;
            },
            registerWorkerTask: (name) => {
                this.server.settings.allow.push(name);
            }
        };
        try {
            this.config = config;
            let __this = this;
            this.serverEvent = new EventEmitter();
            app.get("/alive", (req, res) => {
                res.sendStatus(200);
            });
            this.serverEvent.on("taskEvent", (eventName, data, identifier, workerProxy) => {
                this.serverEvent.emit("taskEvent:" + eventName, data, identifier, workerProxy);
            });
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
                allow: ["task.launch", "task.stop", "task.status.get", "tunnel.create", "tunnel.stop", "tunnel.get", "onEvent"]
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
                    __this._releaseTaskIdentity(client);
                });
                __this.clients = __this.clients.filter(client => client.clientId !== connection.id);
                logger_1.logger.server().debug('Client %s disconnected', connection.id);
            });
            this.server.onError(function (e) {
                logger_1.logger.server().error('An error occurred', e);
            });
            this._internalActions(this);
            if (typeof this.config.intervalPrintStatus != "undefined" && this.config.intervalPrintStatus > 0) {
                setInterval(() => ServerStatus_1.ServerStatus.printServerStatus(this), this.config.intervalPrintStatus * 1000);
            }
        }
        catch (e) {
            logger_1.logger.server().error("Error while constructing server: " + e);
            process.exit(1);
        }
    }
    _internalActions(__this) {
        this.server.exports.ping = function (replyText = false) {
            __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                client.latestReceivedPingTimestamp = Date.now();
            });
            return replyText ? "pong" : 1;
        };
        this.server.exports.task = {
            launch: function (parameters = {}, token = null, args) {
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
                            clientPromises.push(utils_1.promiseTimeout(30000, __this.identityCallback(client.token).then((identity) => {
                                let clientIdentifier = __this.clients.find(x => x.clientId == client.clientId);
                                if (typeof clientIdentifier !== "undefined")
                                    clientIdentifier.identity = identity;
                                return __this.server.getClient(client.clientId).task.launch(identity, __this.taskParameters);
                            })).then(() => ++success)
                                .catch((err) => {
                                ++errors;
                            }));
                        }
                        else {
                            clientPromises.push(utils_1.promiseTimeout(30000, __this.server.getClient(client.clientId).task.launch({}, __this.taskParameters))
                                .then(() => ++success)
                                .catch((err) => {
                                ++errors;
                            }));
                        }
                        ++totalPromised;
                    }
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Unable to launch task", e);
                    ++errors;
                    return [];
                }).then(() => {
                    context.return({
                        success: success,
                        total: total,
                        errors: errors
                    });
                });
            },
            stop: function (token = null, args) {
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
                        clientPromises.push(utils_1.promiseTimeout(30000, __this.server.getClient(client.clientId).task.stop())
                            .catch((e) => {
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
            },
            onLaunched: function () {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Running;
                    __this.serverEvent.emit("taskEvent", "taskLaunched", null, client, workerProxy);
                    __this._saveWorkerLog(client, "taskStatus", "LAUNCHED");
                });
            },
            onStopped: function () {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
                    __this.serverEvent.emit("taskEvent", "taskStopped", null, client, workerProxy);
                    __this._saveWorkerLog(client, "taskStatus", "STOPPED");
                });
            },
            onResult: function (result) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskResult", result, client, workerProxy);
                    __this.events.sendEventToSubscribedCLIs("taskResult", result, client.token);
                    __this._saveWorkerResult(client, result);
                });
            },
            onError: function (error) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskError", error, client, workerProxy);
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Error;
                    __this.events.sendEventToSubscribedCLIs("taskError", error, client.token);
                    __this._saveWorkerLog(client, "taskError", error);
                });
            },
            onEvent: function (eventName, data = null) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", eventName, data, client, workerProxy);
                    __this.events.sendEventToSubscribedCLIs(eventName, data, client.token);
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            onEnded: function (data) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("taskEvent", "taskResult", data, client, workerProxy);
                    client.taskStatus = ClientIdentifier_1.TaskStatus.Ended;
                    let formattedData = (typeof data == "object") ? JSON.stringify(data) : data;
                    __this._saveWorkerLog(client, "taskStatus", `ENDED: ${formattedData}`);
                    __this._releaseTaskIdentity(client);
                });
            },
            b64Image: function (fileName, extension, buffer) {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this._saveWorkerB64Image(client, fileName, extension, buffer);
                    __this._saveWorkerLog(client, "taskStatus", "FILE: " + fileName + "." + extension);
                });
            }
        };
        this.server.exports.task.parameters = {
            get: function () {
                return __this.taskParameters;
            },
            save: function (parameters = {}) {
                __this._saveTaskParameters(parameters);
            }
        };
        this.server.exports.task.status = {
            get: function (token = null, args) {
                let clientPromises = [];
                let context = this;
                context.async = true;
                let total = 0;
                let errors = 0;
                let success = 0;
                let statuses = [];
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
                    clientPromises.push(utils_1.promiseTimeout(30000, __this.server.getClient(client.clientId).task.status.get()).then((status) => {
                        if (status != null)
                            statuses.push(status);
                        ++success;
                    }).catch((err) => {
                        ++errors;
                    }));
                    ++total;
                });
                Promise.all(clientPromises).catch((e) => {
                    logger_1.logger.server().error("Error while getting worker status", e);
                    ++errors;
                    return [];
                }).then(() => {
                    context.return({
                        statuses: statuses,
                        success: success,
                        total: total,
                        errors: errors
                    });
                });
            }
        };
        this.server.exports.tunnel = {
            create: function (token, localPort, isTcp = true) {
                return __awaiter(this, void 0, void 0, function* () {
                    let clientPromises = [];
                    let results = [];
                    let context = this;
                    context.async = true;
                    if (!token)
                        return;
                    __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker && client.token === token)
                        .forEach(client => {
                        clientPromises.push(utils_1.promiseTimeout(30000, __this.server.getClient(client.clientId).tunnel.create(localPort, isTcp)).then((result) => {
                            if (result != null)
                                results.push(result);
                        }).catch((err) => {
                            logger_1.logger.server().error("Error while creating worker tunnel", err);
                        }));
                    });
                    Promise.all(clientPromises).catch((e) => {
                        logger_1.logger.server().error("Error while creating worker tunnel", e);
                        return [];
                    }).then(() => {
                        context.return(results);
                    });
                });
            },
            stop: function (token, localPort, killAll = false) {
                return __awaiter(this, void 0, void 0, function* () {
                    let clientPromises = [];
                    let success = 0;
                    let context = this;
                    context.async = true;
                    __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker && client.token === token)
                        .forEach(client => {
                        clientPromises.push(utils_1.promiseTimeout(30000, __this.server.getClient(client.clientId).tunnel.stop(localPort, killAll)).then((result) => {
                            if (!isNaN(result))
                                success += result;
                        }).catch((err) => {
                            logger_1.logger.server().error("Error while stopping worker tunnel", err);
                        }));
                    });
                    Promise.all(clientPromises).catch((e) => {
                        logger_1.logger.server().error("Error while stopping worker tunnel", e);
                        return [];
                    }).then(() => {
                        context.return({
                            success: success
                        });
                    });
                });
            },
            get: function (token) {
                let clientPromises = [];
                let results = [];
                let context = this;
                context.async = true;
                if (!token)
                    return;
                __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token))
                    .forEach(client => {
                    clientPromises.push(utils_1.promiseTimeout(10000, __this.server.getClient(client.clientId).tunnel.get()).then((data) => {
                        if (Array.isArray(data))
                            results = results.concat(data);
                    }).catch((err) => {
                        logger_1.logger.server().error("Error while getting worker tunnel", err);
                    }));
                });
                Promise.all(clientPromises).catch((err) => {
                    logger_1.logger.server().error("Error while getting worker tunnels", err);
                    return [];
                }).then(() => {
                    context.return(results);
                });
            },
            onEvent: function (eventName, data = null) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("tunnelEvent", eventName, data, client, workerProxy);
                    __this.events.sendEventToSubscribedCLIs(eventName, data, client.token);
                    __this._saveWorkerLog(client, eventName, data);
                });
            },
            onError: function (error) {
                let workerProxy = this.clientProxy;
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    __this.serverEvent.emit("tunnelEvent", "tunnelError", error, client, workerProxy);
                    __this.events.sendEventToSubscribedCLIs("tunnelError", error, client.token);
                    __this._saveWorkerLog(client, "tunnelError", error);
                });
            }
        };
        this.server.exports.cli = {
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
                }).map(client => utils_1.reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierWorkerKeys));
            },
            getWorkersIdentities: function (token = null) {
                return __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.Worker && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.Worker);
                }).map(client => {
                    return Object.assign({
                        token: client.token
                    }, client.identity);
                });
            },
            getCLIs: function (token = null) {
                return __this.clients.filter(client => {
                    return (token !== null) ? (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI && client.token.startsWith(token)) : (client.clientType == ClientIdentifier_1.ClientType.RemoteCLI);
                }).map(client => utils_1.reduceObjectToAllowedKeys(client, __this.filteredClientIdentifierCLIKeys));
            },
            sendEventToWorkers: function (eventName, data, token = null) {
                return __this.events.sendEventToWorkers(eventName, data, token);
            }
        };
    }
    _releaseTaskIdentity(client) {
        if (typeof this.identityCallback === "function" && typeof this.releaseIdentityCallback === "function" && typeof client.identity !== "undefined") {
            this.releaseIdentityCallback(client.identity, client.token).then(() => {
                client.identity = undefined;
            }).catch(() => logger_1.logger.server().error("Unable to release identity for client %s", client.token));
        }
    }
    _saveTaskParameters(parameters = {}) {
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                if (this.taskParameters.hasOwnProperty(parameter.key)) {
                    this.taskParameters[parameter.key] = parameter;
                }
            }
            ;
        }
    }
    _saveWorkerLog(client, eventName, data) {
        if (this.saveLogToDirectory && client.clientType == ClientIdentifier_1.ClientType.Worker) {
            let __this = this;
            let castedData = (typeof data == "object") ? JSON.stringify(data) : data;
            let formatedData;
            let logPath;
            if (this.config.separateInstanceLogFiles) {
                formatedData = "[" + (new Date).toISOString() + "] - [" + eventName.toUpperCase() + "] - " + castedData + "\n";
                logPath = path.join(this.config.logDirectoryPath, client.groupId, client.instanceId + "." + client.token + ".log.json");
            }
            else {
                formatedData = "[" + (new Date).toISOString() + "] - [" + client.instanceId.toUpperCase() + "][" + client.token + "] - [" + eventName.toUpperCase() + "] - " + castedData + "\n";
                logPath = path.join(this.config.logDirectoryPath, client.groupId, "log.json");
            }
            function processErr(err) {
                logger_1.logger.server().error('Unable to save log: ', err);
                __this.events.sendEventToSubscribedCLIs("saveLogError", "Save log error " + err, client.token);
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
            let formatedData = "[" + (new Date).toISOString() + "] - [" + client.token + "] - " + castedData + "\n";
            function processErr(err) {
                logger_1.logger.server().error('Unable to save result: ', err);
                __this.events.sendEventToSubscribedCLIs("saveResultError", "Save log result " + err, client.token);
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
                __this.events.sendEventToSubscribedCLIs("saveImageError", "Save image error " + err, client.token);
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
    logger() {
        return logger_1.logger.server();
    }
}
exports.Server = Server;
//# sourceMappingURL=Server.js.map