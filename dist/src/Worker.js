"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const EventEmitter = require("events");
class Worker extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        this.taskEvent = new EventEmitter();
        this.client.ready((serverProxy) => {
            logger_1.logger.worker().info('Connected to server');
        });
        /**
         * Client internal events handling
         */
        this.client.onConnect((client) => {
            if (this.client.isReady()) //Client reconnected
                logger_1.logger.worker().info('Reconnected to server');
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
            logger_1.logger.worker().info('Client disconnected ', socket.id);
        });
        this._internalActions(this);
    }
    /**
     * Define all internal RPC methods callable for the worker
     * @param {Worker} __this
     * @private
     */
    _internalActions(__this) {
        /**
         * Action on task launch from the server
         * @param {TaskParameterList} parameters
         */
        this.client.exports.launchTask = function (parameters) {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("launchTask", parameters, __this.server);
            __this.server.task.taskLaunched().catch((e) => {
                logger_1.logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Running;
        };
        /**
         * Action on task stop from the server
         */
        this.client.exports.stopTask = function () {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e) => {
                logger_1.logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
        };
        /**
         * Action on status request from the server
         */
        this.client.exports.statusTask = function () {
            //this.serverProxy is injected by eureca
            //TODO: implement
            __this.taskEvent.emit("statusTask", __this.server);
        };
    }
    /**
     * Add handler on task launch request event
     * @param {(parameters: TaskParameterList, server: any) => void} callback
     */
    onLaunchTask(callback) {
        this.taskEvent.on("launchTask", callback);
    }
    /**
     * Add handler on task stop request event
     * @param {(server: any) => void} callback
     */
    onStopTask(callback) {
        this.taskEvent.on("stopTask", callback);
    }
    /**
     * Add handler on task end request event
     * @param {(server: any) => void} callback
     */
    onStatusTask(callback) {
        this.taskEvent.on("statusTask", callback);
    }
    /**
     * Send the task result to the server
     * @param result
     */
    sendTaskResult(result = null) {
        if (this.server !== null)
            this.server.task.taskResult(result);
    }
    /**
     * Send a custom event to the server
     * @param {string} eventName
     * @param data
     */
    sendTaskEvent(eventName, data = null) {
        if (this.server !== null)
            this.server.task.taskEvent(eventName, data);
    }
    /**
     * Send task end status to the server
     * @param data
     */
    sendTaskEnded(data = null) {
        if (this.server !== null)
            this.server.task.taskEnded(data);
        this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map