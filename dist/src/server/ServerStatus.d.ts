import { Server } from './Server';
export interface ServerStatusData {
    connectedWorkers: number;
    connectedClis: number;
    launchedTasks: number;
}
export declare class ServerStatus {
    static getServerStatusData(server: Server): ServerStatusData;
    static printServerStatus(server: Server): void;
}
