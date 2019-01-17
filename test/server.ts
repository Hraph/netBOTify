import {Server} from '../src';
import * as path from 'path';
import {WorkerIdentity} from "../src/models/WorkerIdentity";

interface CustomIdentity extends WorkerIdentity {
    username: string,
    pwd: string
}

let server = new Server({
    port: 8000,
    logDirectoryPath: path.join(__dirname, '..', '..', 'result'),
    resultFilePath: path.join(__dirname, '..', '..', 'result', 'result.json'),
    intervalPrintStatus: 60,
    logger: 'debug'
});

server.addTaskParameter("id", "12345678");

server.onTaskEvent("hello", (data: any, client: any) => {
    console.log("Got event Hello: ", data);
});

let val = 0;

server.onWorkerGetIdentity( () => {
    return new Promise(((resolve, reject) => {
        let identity: CustomIdentity = {
            id: "ID",
            username: "user.name",
            pwd: "password"
        };
        if (val == 1)
            reject();
        console.log("Identity created: " + identity);
        val = 1;
        resolve(identity);
    }));
});

server.onWorkerReleaseIdentity((identity => {
    return new Promise(((resolve, reject) => {
        console.log("Releasing identity: " + identity);
        resolve();
    }))
}));

server.connect();