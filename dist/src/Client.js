"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ClientIdentifier_1 = require("./ClientIdentifier");
const EurecaClient = require("eureca.io").Client;
class Client {
    constructor(config = {}) {
        this.config = {};
        this.server = null;
        this.pingIntervalSecond = 5;
        this.pingTimeoutSecond = 2;
        this.config = config;
        //Default identifier
        this.identifier = config.identifier ? config.identifier : new ClientIdentifier_1.ClientIdentifier("defaultGroup", "defaultInstance");
        /**
         * Client initialization
         * @type {Eureca.Client}
         */
        this.client = new EurecaClient({
            uri: (this.config.uri) ? this.config.uri : "http://localhost:8000/",
            prefix: "nbfy",
            autoConnect: (this.config.autoConnect) ? this.config.autoConnect : true,
        });
        /**
         * Client internal events handling
         */
        this.client.ready((serverProxy) => {
            this.server = serverProxy;
            this.launchPing(serverProxy);
        });
        this.client.onConnect((client) => {
            if (this.client.isReady()) //Client was already connected but is now reconnecting : increment reconnect count
                ++this.identifier.reconnect;
            this.client.authenticate(this.identifier); //Authenticate when connect
            if (this.client.isReady()) //Client was already connected but is now reconnecting : now relaunch ping while it's authenticated
                this.launchPing(client._proxy);
        });
        this.client.onDisconnect((socket) => {
            this.stopPing();
        });
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