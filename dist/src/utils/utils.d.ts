export declare function promiseTimeout(ms: number, promise: Promise<any>): Promise<unknown>;
export declare function promiseAllTimeout(ms: number, promiseArray: Promise<any>[]): Promise<unknown>;
export declare function reduceObjectToAllowedKeys(object: any, keys: any): Object;
export declare function objectGroupByPropertyAndCount(objectArray: any[], prop: string): any;
export declare function objectGroupByProperty(obj: any, prop: string): any;
