export interface TaskIdentity {
    id: any;
}

export interface GetIdentityCallback {
    (): Promise<any>;
}

export interface ReleaseIdentityCallback {
    (identity: any): Promise<void>;
}