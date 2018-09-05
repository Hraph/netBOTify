"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Server_1 = require("../src/Server");
let server = new Server_1.Server({
    port: 8000
});
server.addTaskParameter("id", "12345678");
server.onTaskEvent("hello", (data, client) => {
    console.log("Got event Hello: ", data);
});
server.connect();
//# sourceMappingURL=server.js.map