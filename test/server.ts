import {Server} from '../src';
import * as path from 'path';

let server = new Server({
    port: 8000,
    logDirectoryPath: path.join(__dirname, '..', '..', 'result'),
    resultFilePath: path.join(__dirname, '..', '..', 'result', 'result.json'),
    intervalPrintStatus: 60,
    logger: 'info'
});

server.addTaskParameter("id", "12345678");

server.onTaskEvent("hello", (data: any, client: any) => {
    console.log("Got event Hello: ", data);
});

server.connect();