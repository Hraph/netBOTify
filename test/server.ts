import {Server} from '../src/Server';

let server = new Server({
    port: 8000
});

server.connect();