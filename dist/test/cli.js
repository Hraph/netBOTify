"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const src_2 = require("../src");
let identifier = new src_2.ClientIdentifier("RemoteCLI", "1");
let cli = new src_1.RemoteCLI({
    uri: "http://localhost:8000/",
    identifier: identifier,
    autoSubscribe: true,
    logger: 'debug'
});
cli.addCommand("test", "Write a test", (args, callback) => {
    cli.logger().debug("TEST");
    callback();
});
cli.addCommand("helloWorkers", "Get screenshot", (args, endCommand) => {
    cli.getServerProxy().cli.sendEventToWorkers("workerSayHello", null);
    endCommand();
}, [{
        key: "-b, --bye",
        description: "Say goodbye"
    }]);
cli.onTaskAnyEvent((eventName, data, identifier, workerToken) => {
    cli.logger().debug("Got event %s", eventName);
});
cli.onTaskResult((data, identifier, workerToken) => {
    cli.logger().debug("Got result:", data);
});
//# sourceMappingURL=cli.js.map