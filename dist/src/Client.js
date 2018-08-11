"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("./ClientIdentifier");
const EurecaClient = require("eureca.io").Client;
class Client {
    constructor(config = {}) {
        this.config = {};
        this.server = null;
        this.pingInterval = 0;
        this.pingTimeout = 0;
        this.pingIntervalSecond = 5;
        this.pingTimeoutSecond = 2;
        this.config = config;
        //Default identifier
        if (!config.identifier)
            this.identifier = new ClientIdentifier_1.ClientIdentifier("defaultGroup", "defaultInstance");
        else
            this.identifier = config.identifier;
        //Create Eureca client
        this.client = new EurecaClient({
            uri: (this.config.uri) ? this.config.uri : "http://localhost:8000/",
            prefix: "nbfy",
            autoConnect: (this.config.autoConnect) ? this.config.autoConnect : true,
        });
        this.client.ready((serverProxy) => {
            this.server = serverProxy;
            this.launchPing(serverProxy);
        });
        this.client.onConnect((client) => {
            this.client.authenticate(this.identifier); //Authenticate when connect
            if (this.client.isReady()) //Client was ready but is now reconnecting : relaunch ping
                this.launchPing(client._proxy);
        });
        this.client.onDisconnect((socket) => {
            this.stopPing();
        });
    }
    /**
     * Launch ping interval
     * @param server
     */
    launchPing(server) {
        this.pingInterval = setInterval(() => {
            //Timeout
            this.pingTimeout = setTimeout(() => {
                this.client.trigger("connectionLost");
                this.stopPing();
            }, this.pingTimeoutSecond * 1000);
            server.ping().then((result) => {
                clearTimeout(this.pingTimeout);
            });
        }, this.pingIntervalSecond * 1000);
    }
    /**
     * Stop ping to avoid flood if connection is lost
     */
    stopPing() {
        clearInterval(this.pingInterval);
    }
    /**
     * Manually connect to the server
     * @public
     */
    connect() {
        this.client.connect();
    }
    /**
     * Defines default Client config
     * @param config
     * @returns {{}}
     * @private
     */
    _sanitizeConfig(config = {}) {
        return config;
    }
    /**
     * Add an item to config
     * @param {string} name
     * @param item
     * @returns {this}
     */
    addConfigItem(name, item) {
        this.config[name] = item;
        return this;
    }
}
exports.Client = Client;
//# sourceMappingURL=Client.js.map