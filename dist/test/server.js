"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Server_1 = require("../src/Server");
let server = new Server_1.Server({
    port: 8000
});
server.connect();
//server.addTaskParameter(new TaskParameter("id", "dd"));
//# sourceMappingURL=server.js.map