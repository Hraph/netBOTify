"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const EventEmitter = require("events");
class Worker extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        let __this = this; //Keep context
        this.taskEvent = new EventEmitter();
        this.client.ready((serverProxy) => {
            logger_1.logger.worker().info('Connected to server');
        });
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
        this._internalActions();
        this.client.exports.launchTask = function () {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("launchTask", __this.server);
            __this.server.task.taskLaunched().catch((e) => {
                logger_1.logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Running;
        };
        this.client.exports.stopTask = function () {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e) => {
                logger_1.logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Idle;
        };
    }
    onLaunchTask(callback) {
        this.taskEvent.on("launchTask", callback);
    }
    onStopTask(callback) {
        this.taskEvent.on("stopTask", callback);
    }
    _internalActions() {
    }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map