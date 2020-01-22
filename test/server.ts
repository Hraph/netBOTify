import {Server} from '../src';
import * as path from 'path';
import {TaskIdentity} from "../src/models/TaskIdentity";

interface CustomIdentity extends TaskIdentity {
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

server.task.addTaskParameter("id", "12345678");

server.task.onTaskEvent("hello", (data: any, client: any) => {
    console.log("Got event Hello: ", data);
});

server.task.onTaskIdentityAcquired( () => {
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

server.task.onTaskIdentityReleased((identity => {
    return new Promise(((resolve, reject) => {
        console.log("Releasing identity: " + identity);
        resolve();
    }))
}));

server.connect();