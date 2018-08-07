"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const EurecaServer = require("eureca.io").Server;
const express = require('express'), app = express(), webServer = require('http').createServer(app);
class Server {
    constructor(config = {}) {
        this.clients = [];
        this.config = {};
        this.config = config;
        let __this = this; //Keep context
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
            allow: ["launchTask", "stopTask", "statusTask"]
        });
        this.server.attach(webServer);
        this.server.onMessage(function (msg) {
            logger_1.logger.server().debug('RECV', msg);
        });
        this.server.onConnect(function (connection) {
            logger_1.logger.server().debug("connection", connection);
            let client = connection.clientProxy;
            setTimeout(() => {
                //client.launchTask();
            }, 3000);
        });
        this.server.onDisconnect(function (connection) {
            __this.clients = __this.clients.filter(client => client.clientId !== connection.id); //Remove client from clients
            logger_1.logger.server().info('client %s disconnected', connection.id);
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
            taskLog: function (log) {
            },
            result: function (result) {
                console.log("result");
            }
        };
        this.server.exports.cli = {
            ping: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
            getWorkers: function () {
                return __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker);
            },
            getCLIs: function () {
                return __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.RemoteCLI);
            },
            launchTasks: function () {
                let count = 0;
                __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker).forEach(client => {
                    __this.server.getClient(client.clientId).launchTask().catch((e) => {
                        logger_1.logger.server().error("Unable to launch task ", e);
                    });
                    ++count;
                });
                return count + " tasks launched successfully";
            },
            stopTasks: function () {
                let count = 0;
                __this.clients.filter(client => client.clientType == ClientIdentifier_1.ClientType.Worker).forEach(client => {
                    __this.server.getClient(client.clientId).stopTask().catch((e) => {
                        logger_1.logger.server().error("Unable to stop task ", e);
                    });
                    ++count;
                });
                return count + " tasks stopped successfully";
            }
        };
    }
    /**
     * Launch server
     */
    connect() {
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
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