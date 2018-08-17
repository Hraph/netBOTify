export class TaskParameter {
    public key: string;
    public value: any = null;
    public defaultValue: any = null;
    constructor(key: string, defaultValue: any, value: any = null){
        this.key = key;
        this.defaultValue = defaultValue;
        this.value = value;
    }
}