"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const path = require("path");
let server = new src_1.Server({
    port: 8000,
    logDirectoryPath: path.join(__dirname, '..', '..', 'result'),
    resultFilePath: path.join(__dirname, '..', '..', 'result', 'result.json'),
    intervalPrintStatus: 60,
    logger: 'debug'
});
server.addGlobalParameter("id", "12345678");
server.onTaskEvent("hello", (data, client) => {
    console.log("Got event Hello: ", data);
});
server.onWorkerGetIdentity(() => {
    return new Promise(((resolve, reject) => {
        let identity = {
            id: "ID",
            username: "user.name",
            pwd: "password"
        };
        console.log("Identity created: " + identity);
        resolve(identity);
    }));
});
server.onWorkerReleaseIdentity((identity => {
    return new Promise(((resolve, reject) => {
        console.log("Releasing identity: " + identity);
        resolve();
    }));
}));
server.connect();
server.logger().info("TEST");
//# sourceMappingURL=server.js.map