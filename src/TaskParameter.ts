export class TaskParameter {
    public key: string;
    public value: any = null;
    public defaultValue: any = null;
    public message: string;
    constructor(key: string, defaultValue: any, value: any = null){
        this.key = key;
        this.defaultValue = defaultValue;
        this.value = value;
        this.message = this.key.charAt(0).toUpperCase() + this.key.slice(1); //Uppercase first letter only and add default value
    }
}