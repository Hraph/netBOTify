import {WorkerIdentity} from "./WorkerIdentity";

export enum ClientType {
    Worker = 0,
    RemoteCLI
}

export enum TaskStatus {
    Idle = 0,
    Running,
    Ended,
    Error
}

export class ClientIdentifier {
    public clientType: ClientType = ClientType.Worker;
    public clientId: any = null;
    public token: string;
    public groupId: string;
    public instanceId: string;
    public commitId?: string;
    public latestReceivedPingTimestamp: number = 0;
    public taskStatus: TaskStatus = TaskStatus.Idle;
    public ip: any = null;
    public reconnect: number = 0;
    public identity?: WorkerIdentity;
    [key: string]: any;

    constructor(groupId: string, instanceId: string) {
        this.groupId = groupId;
        this.instanceId = instanceId;
        this.token = this._generateHash();
    }

    /**
     * Generate unique key of 8 char
     * @returns {string}
     * @private
     */
    private _generateHash(){
        return Math.random().toString(36).substring(2, 10);
    }

    /**
     * Get identity for workers ONLY
     * @returns {WorkerIdentity}
     */
    public getWorkerIdentity(){
        return this.identity;
    }

    /**
     * Set the identity wor workers ONLY
     * @param {WorkerIdentity} identity
     */
    public setWorkerIdentity(identity: WorkerIdentity){
        this.identity = identity;
    }
}

