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
cli.customize.addCommand("test", "Write a test", (args, callback) => {
    cli.logger().debug("TEST");
    callback();
});
cli.customize.addCommand("helloWorkers", "Get screenshot", (args, endCommand) => {
    cli.getServerProxy().cli.sendEventToWorkers("workerSayHello", null);
    endCommand();
}, [{
        key: "-b, --bye",
        description: "Say goodbye"
    }]);
cli.events.onAnyEvent((eventName, data, workerToken) => {
    cli.logger().debug("Got event %s (worker %s): %s", eventName, workerToken, data);
});
cli.task.onTaskResult((data, workerToken) => {
    cli.logger().fatal("Got result (worker %s):", workerToken, data);
});
cli.task.onTaskError((error, workerToken) => {
    cli.logger().warn("Task error (worker %s): %s", workerToken, error);
});
cli.tunnel.onTunnelError((error, workerToken) => {
    cli.logger().warn("Tunnel error (worker %s): %s", workerToken, error);
});
//# sourceMappingURL=cli.js.map