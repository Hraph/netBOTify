export interface TaskIdentity {
    id: any;
}
export interface GetIdentityCallback {
    (token: string): Promise<any>;
}
export interface ReleaseIdentityCallback {
    (identity: any, token: string): Promise<void>;
}
