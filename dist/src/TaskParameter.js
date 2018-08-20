"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskParameter {
    constructor(key, defaultValue, value = null) {
        this.value = null;
        this.defaultValue = null;
        this.key = key;
        this.defaultValue = defaultValue;
        if (value == null)
            this.value = defaultValue;
        else
            this.value = value;
        this.message = this.key.charAt(0).toUpperCase() + this.key.slice(1); //Uppercase first letter only and add default value
    }
}
exports.TaskParameter = TaskParameter;
//# sourceMappingURL=TaskParameter.js.map