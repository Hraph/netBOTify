export enum ClientType {
    Worker = 0,
    RemoteCLI
}

export enum TaskStatus {
    Idle = 0,
    Running,
    Error
}


export class ClientIdentifier {
    public clientType: ClientType = ClientType.Worker;
    public clientId: any = null;
    public token: string;
    public groupId: string;
    public instanceId: string;
    public commitId: any = null;
    public latestReceivedPingTimestamp: number = 0;
    public taskStatus: TaskStatus = TaskStatus.Idle;
    public ip: any = null;


    constructor(groupId: string, instanceId: string) {
        this.groupId = groupId;
        this.instanceId = instanceId;
        this.token = this._generateHash();
    }

    private _generateHash(){
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}

