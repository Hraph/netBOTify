"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ClientType;
(function (ClientType) {
    ClientType[ClientType["Worker"] = 0] = "Worker";
    ClientType[ClientType["RemoteCLI"] = 1] = "RemoteCLI";
})(ClientType = exports.ClientType || (exports.ClientType = {}));
var TaskStatus;
(function (TaskStatus) {
    TaskStatus[TaskStatus["Idle"] = 0] = "Idle";
    TaskStatus[TaskStatus["Running"] = 1] = "Running";
    TaskStatus[TaskStatus["Ended"] = 2] = "Ended";
    TaskStatus[TaskStatus["Error"] = 3] = "Error";
})(TaskStatus = exports.TaskStatus || (exports.TaskStatus = {}));
class ClientIdentifier {
    constructor(groupId, instanceId) {
        this.clientType = ClientType.Worker;
        this.clientId = null;
        this.latestReceivedPingTimestamp = 0;
        this.taskStatus = TaskStatus.Idle;
        this.ip = null;
        this.reconnect = 0;
        this.groupId = groupId;
        this.instanceId = instanceId;
        this.token = this._generateHash();
    }
    _generateHash() {
        return Math.random().toString(36).substring(2, 10);
    }
    getWorkerIdentity() {
        return this.identity;
    }
    setWorkerIdentity(identity) {
        this.identity = identity;
    }
}
exports.ClientIdentifier = ClientIdentifier;
//# sourceMappingURL=ClientIdentifier.js.map