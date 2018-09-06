"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
let server = new src_1.Server({
    port: 8000
});
server.addTaskParameter("id", "12345678");
server.onTaskEvent("hello", (data, client) => {
    console.log("Got event Hello: ", data);
});
server.connect();
//# sourceMappingURL=server.js.map