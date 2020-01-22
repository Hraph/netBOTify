"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class TaskParameterItem {
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
exports.TaskParameterItem = TaskParameterItem;
//# sourceMappingURL=TaskParameters.js.map