import { WorkerIdentity } from "./WorkerIdentity";
export declare enum ClientType {
    Worker = 0,
    RemoteCLI = 1
}
export declare enum TaskStatus {
    Idle = 0,
    Running = 1,
    Ended = 2,
    Error = 3
}
export declare class ClientIdentifier {
    clientType: ClientType;
    clientId: any;
    token: string;
    groupId: string;
    instanceId: string;
    commitId?: string;
    latestReceivedPingTimestamp: number;
    taskStatus: TaskStatus;
    ip: any;
    reconnect: number;
    identity?: WorkerIdentity;
    constructor(groupId: string, instanceId: string);
    private _generateHash;
    getWorkerIdentity(): WorkerIdentity | undefined;
    setWorkerIdentity(identity: WorkerIdentity): void;
}
