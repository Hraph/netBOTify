export declare enum ClientType {
    Worker = 0,
    RemoteCLI = 1
}
export declare enum TaskStatus {
    Idle = 0,
    Running = 1,
    Error = 2
}
export declare class ClientIdentifier {
    clientType: ClientType;
    clientId: any;
    token: string;
    groupId: string;
    instanceId: string;
    commitId: any;
    latestReceivedPingTimestamp: number;
    taskStatus: TaskStatus;
    ip: any;
    constructor(groupId: string, instanceId: string);
    private _generateHash;
}
