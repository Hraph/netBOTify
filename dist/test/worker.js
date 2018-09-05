"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Worker_1 = require("../src/Worker");
const ClientIdentifier_1 = require("../src/ClientIdentifier");
let identifier = new ClientIdentifier_1.ClientIdentifier("group1", "1");
let worker = new Worker_1.Worker({
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