"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../utils/logger");
const WorkerTunnel_1 = require("../models/WorkerTunnel");
const WorkerTunnels_1 = require("./WorkerTunnels");
const EventEmitter = require("events");
class Worker extends Client_1.Client {
    constructor(config = {}) {
        super(config);
        this.tunnels = {};
        this.task = {
            onLaunchTask: (callback) => {
                this.taskEvent.on("launchTask", callback);
            },
            onStopTask: (callback) => {
                this.taskEvent.on("stopTask", callback);
            },
            onStatusTask: (callback) => {
                this.getTaskStatusCallback = callback;
            },
            sendTaskResult: (result = null) => {
                if (this.server !== null)
                    this.server.task.onResult(result);
            },
            sendTaskEvent: (eventName, data = null) => {
                if (this.server !== null)
                    this.server.task.onEvent(eventName, data);
            },
            sendTaskError: (error = null) => {
                if (this.server !== null)
                    this.server.task.onError(error);
                this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Error;
            },
            sendTaskEnded: (data = null) => {
                if (this.server !== null)
                    this.server.task.onEnded(data);
                this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Ended;
            },
            sendB64Image: (fileName, extension, buffer) => {
                if (this.server !== null)
                    this.server.task.b64Image(fileName, extension, buffer);
            }
        };
        this.events = {
            onServerEvent: (eventName, callback) => {
                this.taskEvent.on("serverEvent:" + eventName, callback);
            },
        };
        this.taskEvent = new EventEmitter();
        try {
            if (config.logger)
                logger_1.logger.setWorkerLevel(config.logger);
            try {
                if (config.tunnelProvider) {
                    if (config.tunnelProvider == WorkerTunnel_1.TunnelProvider.Ngrok) {
                        this.tunnelProvider = new WorkerTunnels_1.WorkerTunnelNgrok(config.tunnelProviderConfig);
                    }
                    else
                        logger_1.logger.worker().error(`Invalid Tunnel provider: ${config.tunnelProvider}`);
                }
            }
            catch (e) {
                logger_1.logger.worker().error(`Tunnel error: ${e}`);
            }
            this.client.ready((serverProxy) => {
                logger_1.logger.worker().debug('Connected to server');
            });
            this.client.onConnect((client) => {
                if (this.client.isReady())
                    logger_1.logger.worker().debug('Reconnected to server');
            });
            this.client.onUnhandledMessage(function (data) {
                logger_1.logger.worker().debug('Received message: ', data);
            });
            this.client.onError(function (e) {
                if (e.type === "TransportError") {
                    logger_1.logger.worker().error("Unable to connect to server: code", e.description);
                }
                else {
                    logger_1.logger.worker().error('Unknown error ', e);
                }
            });
            this.client.onConnectionLost(function () {
                logger_1.logger.worker().warn('Connection lost ... will try to reconnect');
            });
            this.client.onConnectionRetry(function (socket) {
                logger_1.logger.worker().warn('retrying ...');
            });
            this.client.onDisconnect(function (socket) {
                logger_1.logger.worker().debug('Client disconnected ', socket.id);
            });
            this._internalActions(this);
        }
        catch (e) {
            logger_1.logger.worker().error("Error while constructing worker: " + e);
            process.exit(1);
        }
    }
    _internalActions(__this) {
        this.client.exports.task = {
            launch: function (identity, parameters) {
                __this.taskEvent.emit("launchTask", identity, parameters, __this.server);
                __this.server.task.onLaunched().catch((e) => {
                    logger_1.logger.worker().error("Unable to execute command ", e);
                });
                __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Running;
            },
            stop: function () {
                __this.taskEvent.emit("stopTask", __this.server);
                __this.server.task.onStopped().catch((e) => {
                    logger_1.logger.worker().error("Unable to execute command ", e);
                });
                __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
            },
        };
        this.client.exports.task.status = {
            get: function () {
                let context = this;
                context.async = true;
                if (__this.getTaskStatusCallback != null)
                    return __this.getTaskStatusCallback(__this.server).then(data => context.return(data));
                else
                    context.return(null);
            }
        };
        this.client.exports.tunnel = {
            create: function (localPort, isTcp = true) {
                return __awaiter(this, void 0, void 0, function* () {
                    let context = this;
                    context.async = true;
                    if (__this.tunnelProvider) {
                        try {
                            if (!__this.tunnels.hasOwnProperty(localPort))
                                __this.tunnels[localPort] = {
                                    localPort: localPort,
                                    url: "",
                                    provider: __this.tunnelProvider.type,
                                    status: WorkerTunnel_1.TunnelStatus.Stopped
                                };
                            if (__this.tunnels[localPort].status === WorkerTunnel_1.TunnelStatus.Stopped) {
                                let url = yield __this.tunnelProvider.connect(localPort, isTcp, (status) => {
                                    __this.tunnels[localPort].status = status;
                                });
                                __this.tunnels[localPort].url = url;
                                __this.tunnels[localPort].status = WorkerTunnel_1.TunnelStatus.Connected;
                                logger_1.logger.worker().debug(`Tunnel created on port ${localPort}: ${url} `);
                                __this.server.tunnel.onEvent("tunnelCreated", url);
                                return context.return(__this.tunnels[localPort]);
                            }
                            else {
                                logger_1.logger.worker().debug(`Tunnel error: Tunnel already started ${localPort}`);
                                __this.server.tunnel.onError(`Tunnel error: Tunnel already started ${localPort}`);
                                return context.return(__this.tunnels[localPort]);
                            }
                        }
                        catch (e) {
                            logger_1.logger.worker().error(e);
                            __this.server.tunnel.onError(`Tunnel error: ${e}`);
                            return context.return(null);
                        }
                    }
                    else
                        __this.server.tunnel.onError(`Tunnel error: provider not setup!`);
                });
            },
            stop: function (localPort, killAll = false) {
                return __awaiter(this, void 0, void 0, function* () {
                    let context = this;
                    context.async = true;
                    if (__this.tunnelProvider) {
                        try {
                            if (killAll) {
                                yield __this.tunnelProvider.kill();
                                let count = Object.keys(__this.tunnels).length;
                                __this.tunnels = [];
                                logger_1.logger.worker().debug(`All tunnels killed`);
                                return context.return(count);
                            }
                            else {
                                if (__this.tunnels.hasOwnProperty(localPort) && __this.tunnels[localPort].status != WorkerTunnel_1.TunnelStatus.Stopped && __this.tunnels[localPort].url) {
                                    yield __this.tunnelProvider.disconnect(__this.tunnels[localPort].url);
                                    __this.tunnels[localPort].url = "";
                                    __this.tunnels[localPort].status = WorkerTunnel_1.TunnelStatus.Stopped;
                                    logger_1.logger.worker().debug(`Tunnel stopped on port ${localPort}`);
                                    __this.server.tunnel.onEvent("tunnelStopped", localPort);
                                    return context.return(1);
                                }
                                else {
                                    logger_1.logger.worker().debug(`Tunnel error: No tunnel exists on port ${localPort}`);
                                    return context.return(0);
                                }
                            }
                        }
                        catch (e) {
                            logger_1.logger.worker().error(e);
                            __this.server.tunnel.onError(`Tunnel error: ${e}`);
                            return context.return(0);
                        }
                    }
                    else
                        __this.server.tunnel.onError(`Tunnel error: provider not setup!`);
                });
            },
            get: function () {
                let context = this;
                context.async = true;
                return context.return(Object.values(__this.tunnels));
            }
        };
        this.client.exports.onEvent = function (eventName, data = null) {
            __this.taskEvent.emit("serverEvent:" + eventName, __this.server, data);
        };
    }
    logger() {
        return logger_1.logger.worker();
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map