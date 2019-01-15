export class GlobalParameter<T> {
    public key: string;
    public value?: T;
    public defaultValue?: T;
    public message: string;
    constructor(key: string, defaultValue: T, value: any = null){
        this.key = key;
        this.defaultValue = defaultValue;
        if (value == null)
            this.value = defaultValue;
        else
            this.value = value;
        this.message = this.key.charAt(0).toUpperCase() + this.key.slice(1); //Uppercase first letter only and add default value
    }
}

export interface GlobalParameterList {
    [key: string]: GlobalParameter<any>
}