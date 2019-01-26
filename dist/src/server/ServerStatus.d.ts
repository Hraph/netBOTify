import { Server } from './Server';
export interface ServerStatusData {
    connectedWorkers: number;
    connectedClis: number;
    idleTasks: number;
    launchedTasks: number;
    endedTasks: number;
    errorTasks: number;
}
export declare class ServerStatus {
    static getServerStatusData(server: Server): ServerStatusData;
    static printServerStatus(server: Server): void;
}
