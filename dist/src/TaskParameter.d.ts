export declare class TaskParameter {
    key: string;
    value: any;
    defaultValue: any;
    message: string;
    constructor(key: string, defaultValue: any, value?: any);
}
export interface TaskParameterList {
    [key: string]: TaskParameter;
}
