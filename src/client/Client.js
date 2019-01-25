"use strict";
var ClientIdentifier_1 = require("../models/ClientIdentifier");
var logger_1 = require("../logger");
var eureca_io_1 = require('eureca.io');
var Client = (function () {
    function Client(config) {
        var _this = this;
        if (config === void 0) { config = {}; }
        this.config = {};
        this.server = null;
        this.pingIntervalSecond = 5;
        this.pingTimeoutSecond = 2;
        this.config = config;
        //Default identifier
        this.identifier = config.identifier ? config.identifier : new ClientIdentifier_1.ClientIdentifier("defaultGroup", "defaultInstance");
        try {
            /**
             * Client initialization
             * @type {EurecaClient}
             */
            this.client = new eureca_io_1.Client({
                uri: (this.config.uri) ? this.config.uri : "http://localhost:8000/",
                prefix: "nbfy",
                autoConnect: (this.config.autoConnect) ? this.config.autoConnect : true
            });
            /**
             * Client internal events handling
             */
            this.client.ready(function (serverProxy) {
                _this.server = serverProxy;
                _this.launchPing(serverProxy);
            });
            this.client.onConnect(function (client) {
                if (_this.client.isReady())
                    ++_this.identifier.reconnect;
                _this.client.authenticate(_this.identifier); //Authenticate when connect
                if (_this.client.isReady())
                    _this.launchPing(client._proxy);
            });
            this.client.onDisconnect(function (socket) {
                _this.stopPing();
            });
        }
        catch (e) {
            logger_1.logger.error("Error while constructing client: " + e);
            process.exit(1);
        }
    }
    /**
     * Defines default Client config
     * @param config
     * @returns {{}}
     * @private
     */
    Client.prototype._sanitizeConfig = function (config) {
        if (config === void 0) { config = {}; }
        return config;
    };
    /**
     * Launch ping interval
     * @param server
     */
    Client.prototype.launchPing = function (server) {
        var _this = this;
        this.pingInterval = setInterval(function () {
            //Timeout
            _this.pingTimeout = setTimeout(function () {
                _this.client.trigger("connectionLost");
                _this.stopPing();
            }, _this.pingTimeoutSecond * 1000);
            server.ping().then(function (result) {
                clearTimeout(_this.pingTimeout);
            });
        }, this.pingIntervalSecond * 1000);
    };
    /**
     * Stop ping to avoid flood if connection is lost
     */
    Client.prototype.stopPing = function () {
        clearInterval(this.pingInterval);
    };
    /**
     * Manually connect to the server
     * @public
     */
    Client.prototype.connect = function () {
        this.client.connect();
    };
    /**
     * Add an item to config
     * @param {string} name
     * @param item
     * @returns {this}
     */
    Client.prototype.addConfigItem = function (name, item) {
        this.config[name] = item;
        return this;
    };
    return Client;
}());
exports.Client = Client;
