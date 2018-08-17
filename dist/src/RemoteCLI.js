"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const TaskParameter_1 = require("./TaskParameter");
const EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
class RemoteCLI extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        let __this = this; //Keep context
        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientIdentifier_1.ClientType.RemoteCLI;
        this.client.ready((serverProxy) => {
            logger_1.logger.cli().info("Connected to server");
            //Launch vorpal
            vorpal.show();
        });
        this.client.onConnectionLost(() => {
            logger_1.logger.cli().info("Disconnected to server\n");
            vorpal.hide();
        });
        this.client.onConnect(() => {
            if (this.client.isReady()) { //Client was ready but is now reconnecting : relaunch vorpal
                logger_1.logger.cli().info("Reconnected to server\n");
                vorpal.show();
            }
        });
        this.client.onError(function (e) {
            if (e.type === "TransportError") {
                logger_1.logger.cli().error("Unable to connect to server: code", e.description);
            }
            else {
                logger_1.logger.cli().error('Unknown error', e);
            }
        });
        //Define config delimiter
        if (!this.config.delimiter)
            this.config.delimiter = "netBOTify";
        //Vorpal config
        vorpal
            .delimiter(this.config.delimiter + '$');
        vorpal
            .command('ping', 'Ping the server.')
            .action((args, callback) => {
            this._executePrintDistantCommand("ping", callback);
        });
        vorpal
            .command('launch', 'Launch the task on workers.')
            .action((args, callback) => {
            try {
                let parameters = [];
                parameters.push(new TaskParameter_1.TaskParameter("id", null, "other"));
                this.server.cli["launchTask"](parameters).then((result) => {
                    console.log(result);
                });
            }
            catch (e) {
                this._serverInvalidCommandError(e);
            }
            finally {
                callback();
            }
        });
        vorpal
            .command('stop', 'Stop the task on workers.')
            .action((args, callback) => {
            this._executePrintDistantCommand("stopTask", callback);
        });
        vorpal
            .command('workers', 'Get server connected workers')
            .action((args, callback) => {
            this._executeTableDistantCommand("getWorkers", callback);
        });
        vorpal
            .command('clis', 'Get server connected CLIs')
            .action((args, callback) => {
            this._executeTableDistantCommand("getCLIs", callback);
        });
    }
    addCommand(commandWord, commandDescription, callback) {
        vorpal
            .command(commandWord, commandDescription)
            .action((vorpalArgs, vorpalCallback) => {
            callback(vorpalArgs, vorpalCallback);
        });
    }
    _executePrintDistantCommand(commandName, callback) {
        try {
            this.server.cli[commandName]().then((result) => {
                console.log(result);
            });
        }
        catch (e) {
            this._serverInvalidCommandError(e);
        }
        finally {
            callback();
        }
    }
    _executeTableDistantCommand(commandName, callback) {
        try {
            this.server.cli[commandName]().then((result) => {
                console.log(result.length + " items");
                console.table(result);
            });
        }
        catch (e) {
            this._serverInvalidCommandError(e);
        }
        finally {
            callback();
        }
    }
    _serverInvalidCommandError(e) {
        logger_1.logger.cli().error("Error in command ", e);
    }
}
exports.RemoteCLI = RemoteCLI;
//# sourceMappingURL=RemoteCLI.js.map