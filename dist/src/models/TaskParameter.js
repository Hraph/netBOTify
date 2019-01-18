"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskParameter {
    constructor(key, defaultValue, value = null) {
        this.key = key;
        this.defaultValue = defaultValue;
        if (value == null)
            this.value = defaultValue;
        else
            this.value = value;
        this.message = this.key.charAt(0).toUpperCase() + this.key.slice(1);
    }
}
exports.TaskParameter = TaskParameter;
//# sourceMappingURL=GlobalParameter.js.map