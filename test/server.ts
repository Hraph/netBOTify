import {Server} from '../src/Server';
import {TaskParameter} from "../src/TaskParameter";

let server = new Server({
    port: 8000
});

server.addTaskParameter("id", "12345678");

server.connect();