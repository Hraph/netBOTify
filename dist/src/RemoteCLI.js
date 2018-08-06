"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
class RemoteCLI extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        let __this = this; //Keep context
        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientIdentifier_1.ClientType.RemoteCLI;
        this.client.ready((serverProxy) => {
            console.log("Connected to server");
            //Launch vorpal
            vorpal.show();
        });
        this.client.onConnectionLost(() => {
            console.log("Disconnected to server\n");
            vorpal.hide();
        });
        this.client.onConnect(() => {
            if (this.client.isReady()) { //Client was ready but is now reconnecting : relaunch vorpal
                console.log("Reconnected to server\n");
                vorpal.show();
            }
        });
        this.client.onError(function (e) {
            console.log('error', e);
        });
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
            .command('launch', 'Launch the tasks on workers.')
            .action((args, callback) => {
            this._executePrintDistantCommand("launchTasks", callback);
        });
        vorpal
            .command('stop', 'Stop the tasks on workers.')
            .action((args, callback) => {
            this._executePrintDistantCommand("stopTasks", callback);
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
        console.log("Error in command ", e);
    }
}
exports.RemoteCLI = RemoteCLI;
//# sourceMappingURL=RemoteCLI.js.map