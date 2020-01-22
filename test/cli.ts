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

cli.task.onTaskAnyEvent((eventName: string, data: any, identifier: ClientIdentifier, workerToken: string) => {
    cli.logger().debug("Got event %s", eventName);
});

cli.task.onTaskResult((data: any, identifier: ClientIdentifier, workerToken: string) => {
    cli.logger().debug("Got result:", data);
});