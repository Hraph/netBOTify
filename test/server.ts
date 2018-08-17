import {Server} from '../src/Server';
import { TaskParameter } from "../src/TaskParameter";

let server = new Server({
    port: 8000
});

server.connect();

server.addTaskParameter(new TaskParameter("id", "dd"));