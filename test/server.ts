import {Server} from '../src';

let server = new Server({
    port: 8000
});

server.addTaskParameter("id", "12345678");

server.onTaskEvent("hello", (data: any, client: any) => {
    console.log("Got event Hello: ", data);
});

server.connect();