export declare class GlobalParameter<T> {
    key: string;
    value?: T;
    defaultValue?: T;
    message: string;
    constructor(key: string, defaultValue: T, value?: any);
}
export interface GlobalParameterList {
    [key: string]: GlobalParameter<any>;
}
