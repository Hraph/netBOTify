export interface WorkerIdentity {
    id: any;
}
export interface GetIdentityCallback {
    (): Promise<WorkerIdentity>;
}
export interface ReleaseIdentityCallback {
    (identity: WorkerIdentity): Promise<void>;
}
