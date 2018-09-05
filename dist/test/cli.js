"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RemoteCLI_1 = require("../src/RemoteCLI");
const ClientIdentifier_1 = require("../src/ClientIdentifier");
let identifier = new ClientIdentifier_1.ClientIdentifier("RemoteCLI", "1");
let cli = new RemoteCLI_1.RemoteCLI({
    uri: "http://localhost:8000/",
    identifier: identifier,
    autoSubscribe: true
});
cli.addCommand("test", "Write a test", (args, callback) => {
    console.log("TEST");
    callback();
});
//# sourceMappingURL=cli.js.map