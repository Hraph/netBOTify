import Worker from '../src/Worker';
import ClientIdentifier from '../src/ClientIdentifier';


let identifier = new ClientIdentifier("group1", "1");

let worker = new Worker({
    uri: "http://localhost:8000/",
    identifier: identifier
});

worker.onLaunchTask((server: any) => {
    console.log("launch", server);
    server.taskLaunched();
});