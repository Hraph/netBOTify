"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../utils/logger");
const ClientIdentifier_1 = require("../models/ClientIdentifier");
class ServerStatus {
    static getServerStatusData(server) {
        return {
            connectedWorkers: server.clients.filter((x) => x.clientType == ClientIdentifier_1.ClientType.Worker).length,
            connectedClis: server.clients.filter((x) => x.clientType == ClientIdentifier_1.ClientType.RemoteCLI).length,
            idleTasks: server.clients.filter((x) => x.taskStatus == ClientIdentifier_1.TaskStatus.Idle && x.clientType == ClientIdentifier_1.ClientType.Worker).length,
            launchedTasks: server.clients.filter((x) => x.taskStatus == ClientIdentifier_1.TaskStatus.Running && x.clientType == ClientIdentifier_1.ClientType.Worker).length,
            endedTasks: server.clients.filter((x) => x.taskStatus == ClientIdentifier_1.TaskStatus.Ended && x.clientType == ClientIdentifier_1.ClientType.Worker).length,
            errorTasks: server.clients.filter((x) => x.taskStatus == ClientIdentifier_1.TaskStatus.Error && x.clientType == ClientIdentifier_1.ClientType.Worker).length
        };
    }
    static printServerStatus(server) {
        let status = this.getServerStatusData(server);
        logger_1.logger.server().info("%d worker(s) connected, %d/%d idle, %d/%d launched, %d/%d ended, %d/%d error - %d CLI(s) connected", status.connectedWorkers, status.idleTasks, status.connectedWorkers, status.launchedTasks, status.connectedWorkers, status.endedTasks, status.connectedWorkers, status.errorTasks, status.connectedWorkers, status.connectedClis);
    }
}
exports.ServerStatus = ServerStatus;
//# sourceMappingURL=ServerStatus.js.map