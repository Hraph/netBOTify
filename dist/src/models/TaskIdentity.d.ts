export interface TaskIdentity {
    id: any;
}
export interface GetIdentityCallback {
    (): Promise<TaskIdentity>;
}
export interface ReleaseIdentityCallback {
    (identity: TaskIdentity): Promise<void>;
}
