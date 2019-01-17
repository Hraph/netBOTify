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

server.onWorkerGetIdentity( () => {
    return new Promise(((resolve, reject) => {
        let identity: CustomIdentity = {
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
    }))
}));

server.connect();