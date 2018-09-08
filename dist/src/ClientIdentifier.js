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
    TaskStatus[TaskStatus["Error"] = 2] = "Error";
})(TaskStatus = exports.TaskStatus || (exports.TaskStatus = {}));
class ClientIdentifier {
    constructor(groupId, instanceId) {
        this.clientType = ClientType.Worker;
        this.clientId = null;
        this.commitId = null;
        this.latestReceivedPingTimestamp = 0;
        this.taskStatus = TaskStatus.Idle;
        this.ip = null;
        this.reconnect = 0;
        this.groupId = groupId;
        this.instanceId = instanceId;
        this.token = this._generateHash();
    }
    _generateHash() {
        return Math.random().toString(36).substring(2, 15);
    }
}
exports.ClientIdentifier = ClientIdentifier;
//# sourceMappingURL=ClientIdentifier.js.map