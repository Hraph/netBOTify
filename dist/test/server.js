"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const path = require("path");
let server = new src_1.Server({
    port: 8000,
    logDirectoryPath: path.join(__dirname, '..', '..', 'result'),
    resultFilePath: path.join(__dirname, '..', '..', 'result', 'result.json')
});
server.addTaskParameter("id", "12345678");
server.onTaskEvent("hello", (data, client) => {
    console.log("Got event Hello: ", data);
});
server.connect();
//# sourceMappingURL=server.js.map