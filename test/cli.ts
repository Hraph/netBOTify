import {RemoteCLI} from '../src';
import {ClientIdentifier, ClientType} from '../src';


let identifier = new ClientIdentifier("RemoteCLI", "1");

let cli = new RemoteCLI({
    uri: "http://localhost:8000/",
    identifier: identifier,
    autoSubscribe: true,
    logger: 'debug'
});

cli.customize.addCommand("test", "Write a test", (args: any, callback: Function) => {
    cli.logger().debug("TEST");
    callback();
});

cli.customize.addCommand("helloWorkers", "Get screenshot", (args, endCommand) => {
    cli.getServerProxy().cli.sendEventToWorkers("workerSayHello", null); //Send event
    endCommand();
}, [{
    key: "-b, --bye",
    description: "Say goodbye"
}]);

cli.events.onAnyEvent((eventName: string, data: any, workerToken: string) => {
    cli.logger().debug("Got event %s (worker %s): %s", eventName, workerToken, data);
});

cli.task.onTaskResult((data: any, workerToken: string) => {
    cli.logger().fatal("Got result (worker %s):", workerToken, data);
});

cli.task.onTaskError((error: any, workerToken: string) => {
    cli.logger().warn("Task error (worker %s): %s", workerToken, error);
});

cli.tunnel.onTunnelError((error: any, workerToken: string) => {
    cli.logger().warn("Tunnel error (worker %s): %s", workerToken, error);
});