export declare class TaskParameterItem<T> {
    key: string;
    value?: T;
    defaultValue?: T;
    message: string;
    constructor(key: string, defaultValue: T, value?: any);
}
export interface TaskParameterList {
    [key: string]: TaskParameterItem<any>;
}
