import {Server} from './Server';
import {logger} from "../logger";
import {ClientIdentifier, ClientType, TaskStatus} from "../models/ClientIdentifier";

export interface ServerStatusData {
    connectedWorkers: number,
    connectedClis: number,
    launchedTasks: number,
    endedTasks: number,
    errorTasks: number
}

export class ServerStatus {
    /**
     * Get current ServerStatusData
     * @param {Server} server
     * @returns {ServerStatusData}
     */
    public static getServerStatusData(server: Server): ServerStatusData {
        return {
            connectedWorkers: server.clients.filter((x: ClientIdentifier) => x.clientType == ClientType.Worker).length,
            connectedClis: server.clients.filter((x: ClientIdentifier) => x.clientType == ClientType.RemoteCLI).length,
            launchedTasks: server.clients.filter((x: ClientIdentifier) => x.taskStatus == TaskStatus.Running).length,
            endedTasks: server.clients.filter((x: ClientIdentifier) => x.taskStatus == TaskStatus.Ended).length,
            errorTasks: server.clients.filter((x: ClientIdentifier) => x.taskStatus == TaskStatus.Error).length
        };
    }

    /**
     * Print the server status to info logger
     * @param {Server} server
     */
    public static printServerStatus(server: Server){
        let status = this.getServerStatusData(server);
        logger.server().info("%d worker(s) connected, %d/%d launched, %d/%d ended, %d/%d error, %d CLI(s) connected", status.connectedWorkers, status.launchedTasks, status.connectedWorkers, status.endedTasks, status.connectedWorkers, status.errorTasks, status.connectedWorkers, status.connectedClis);
    }
}