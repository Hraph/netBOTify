import {RemoteCLI} from '../src';
import {ClientIdentifier, ClientType} from '../src';


let identifier = new ClientIdentifier("RemoteCLI", "1");

let cli = new RemoteCLI({
    uri: "http://localhost:8000/",
    identifier: identifier,
    autoSubscribe: true,
    logger: 'debug'
});

cli.addCommand("test", "Write a test", (args: any, callback: Function) => {
    console.log("TEST");
    callback();
});

cli.addCommand("helloWorkers", "Get screenshot", (args, endCommand) => {
    cli.getServerProxy().cli.sendEventToWorkers("workerSayHello", null); //Send event
    endCommand();
}, [{
    key: "-b, --bye",
    description: "Say goodbye"
}]);