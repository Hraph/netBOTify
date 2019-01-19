"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../logger");
const eureca_io_1 = require("eureca.io");
class Client {
    constructor(config = {}) {
        this.config = {};
        this.server = null;
        this.pingIntervalSecond = 5;
        this.pingTimeoutSecond = 2;
        this.config = config;
        this.identifier = config.identifier ? config.identifier : new ClientIdentifier_1.ClientIdentifier("defaultGroup", "defaultInstance");
        try {
            this.client = new eureca_io_1.Client({
                uri: (this.config.uri) ? this.config.uri : "http://localhost:8000/",
                prefix: "nbfy",
                autoConnect: (this.config.autoConnect) ? this.config.autoConnect : true,
            });
            this.client.ready((serverProxy) => {
                this.server = serverProxy;
                this.launchPing(serverProxy);
            });
            this.client.onConnect((client) => {
                if (this.client.isReady())
                    ++this.identifier.reconnect;
                this.client.authenticate(this.identifier);
                if (this.client.isReady())
                    this.launchPing(client._proxy);
            });
            this.client.onDisconnect((socket) => {
                this.stopPing();
            });
        }
        catch (e) {
            logger_1.logger.error("Error while constructing client: " + e);
            process.exit(1);
        }
    }
    _sanitizeConfig(config = {}) {
        return config;
    }
    launchPing(server) {
        this.pingInterval = setInterval(() => {
            this.pingTimeout = setTimeout(() => {
                this.client.trigger("connectionLost");
                this.stopPing();
            }, this.pingTimeoutSecond * 1000);
            server.ping().then((result) => {
                clearTimeout(this.pingTimeout);
            });
        }, this.pingIntervalSecond * 1000);
    }
    stopPing() {
        clearInterval(this.pingInterval);
    }
    connect() {
        this.client.connect();
    }
    addConfigItem(name, item) {
        this.config[name] = item;
        return this;
    }
}
exports.Client = Client;
//# sourceMappingURL=Client.js.map