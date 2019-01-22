"use strict";
(function (ClientType) {
    ClientType[ClientType["Worker"] = 0] = "Worker";
    ClientType[ClientType["RemoteCLI"] = 1] = "RemoteCLI";
})(exports.ClientType || (exports.ClientType = {}));
var ClientType = exports.ClientType;
(function (TaskStatus) {
    TaskStatus[TaskStatus["Idle"] = 0] = "Idle";
    TaskStatus[TaskStatus["Running"] = 1] = "Running";
    TaskStatus[TaskStatus["Error"] = 2] = "Error";
})(exports.TaskStatus || (exports.TaskStatus = {}));
var TaskStatus = exports.TaskStatus;
var ClientIdentifier = (function () {
    function ClientIdentifier(groupId, instanceId) {
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
    /**
     * Generate unique key of 8 char
     * @returns {string}
     * @private
     */
    ClientIdentifier.prototype._generateHash = function () {
        return Math.random().toString(36).substring(2, 10);
    };
    /**
     * Get identity for workers ONLY
     * @returns {WorkerIdentity}
     */
    ClientIdentifier.prototype.getWorkerIdentity = function () {
        return this.identity;
    };
    /**
     * Set the identity wor workers ONLY
     * @param {WorkerIdentity} identity
     */
    ClientIdentifier.prototype.setWorkerIdentity = function (identity) {
        this.identity = identity;
    };
    return ClientIdentifier;
}());
exports.ClientIdentifier = ClientIdentifier;
