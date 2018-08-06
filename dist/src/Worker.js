"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const EventEmitter = require("events");
class Worker extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        let __this = this; //Keep context
        this.taskEvent = new EventEmitter();
        this.client.ready((serverProxy) => {
        });
        this.client.onConnect((connection) => {
            //__this.identifier.clientId = connection.id;
            console.log('Incomming connection');
        });
        this.client.onMessage(function (data) {
            console.log('Received data', data);
        });
        this.client.onError(function (e) {
            console.log('error', e);
        });
        this.client.onConnectionLost(function () {
            console.log('connection lost ... will try to reconnect');
        });
        this.client.onConnectionRetry(function (socket) {
            console.log('retrying ...');
        });
        this.client.onDisconnect(function (socket) {
            console.log('Client disconnected ', socket.id);
        });
        this.client.on("reconnecting", () => {
            console.log("update");
        });
        this._internalActions();
        this.client.exports.launchTask = function () {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("launchTask", __this.server);
            __this.server.task.taskLaunched().catch((e) => {
                console.log("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = ClientIdentifier_1.TaskStatus.Running;
        };
        this.client.exports.stopTask = function () {
            //this.serverProxy is injected by eureca
            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e) => {
                console.log("Unable to execute command ", e);
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