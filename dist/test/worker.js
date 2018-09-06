"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const src_2 = require("../src");
let identifier = new src_2.ClientIdentifier("group1", "1");
let worker = new src_1.Worker({
    uri: "http://localhost:8000/",
    identifier: identifier
});
worker.onLaunchTask((parameters, server) => {
    console.log("launch", parameters);
    worker.sendTaskEvent("hello", ["h", "e", "l", "l", "o"]);
});
worker.onStopTask((server) => {
    console.log("stop");
    worker.sendTaskResult("Ok");
    worker.sendTaskEnded();
});
//# sourceMappingURL=worker.js.map