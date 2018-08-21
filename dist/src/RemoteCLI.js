"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("./ClientIdentifier");
const logger_1 = require("./logger");
const EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
class RemoteCLI extends Client_1.Client {
    constructor(config = {}) {
        super(config); //Create client
        this.taskParameters = null;
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
        //Ping
        vorpal
            .command('ping', 'Ping the server.')
            .action((args, callback) => {
            __this._executeDistantCommand("ping").then(() => {
                callback();
            });
        });
        //Launch
        vorpal
            .command('launch', 'Launch the task on workers.')
            .option('-f, --force', "Force sending start even if it's already launched")
            .action(function (args, callback) {
            let setParametersCommandPromise = [];
            //Parameters has not been retrieved before: SET UP PARAMETERS
            if (__this.taskParameters == null) {
                vorpal.log("Parameters has not been set!");
                vorpal.log("----------------------------");
                // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                setParametersCommandPromise.push(__this._setupTaskParameters(this)); //Relaunch command
            }
            //Parameters has been set
            Promise.all(setParametersCommandPromise).then(() => {
                __this._executeDistantCommand("launchTask", __this.taskParameters, args.options.force) //Execute task with parameters
                    .catch(__this._serverInvalidCommandError)
                    .then((result) => {
                    vorpal.log("%d worker%s'task launched of %d worker%s", result.success, (result.success >= 2) ? "s" : "", result.total, (result.total >= 2) ? "s" : "");
                    callback();
                });
            });
        });
        //Parameters
        vorpal
            .command('parameters', 'Manage task parameters.')
            .option("-r, --reload", "Erase and reload the current parameters from the server.")
            .action(function (args, callback) {
            // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
            __this._setupTaskParameters(this, args.options.reload).then(() => {
                callback();
            });
        });
        //Stop
        vorpal
            .command('stop', 'Stop the task on workers.')
            .option('-f, --force', "Force sending stop even if it's already stopped")
            .action((args, callback) => {
            __this._executeDistantCommand("stopTask", args.options.force)
                .catch(__this._serverInvalidCommandError)
                .then((result) => {
                vorpal.log("%d worker%s'task stopped of %d worker%s", result.success, (result.success >= 2) ? "s" : "", result.total, (result.total >= 2) ? "s" : "");
                callback();
            });
        });
        //Workers
        vorpal
            .command('workers', 'Get server connected workers')
            .action((args, callback) => {
            __this._executeDistantCommand("getWorkers")
                .catch(__this._serverInvalidCommandError)
                .then((result) => {
                vorpal.log(result.length + " workers");
                vorpal.log(cTable.getTable(result));
                callback();
            });
        });
        //CLIs
        vorpal
            .command('clis', 'Get server connected CLIs')
            .action((args, callback) => {
            __this._executeDistantCommand("getCLIs")
                .catch(__this._serverInvalidCommandError)
                .then((result) => {
                vorpal.log(result.length + " CLIs");
                vorpal.log(cTable.getTable(result));
                callback();
            });
        });
    }
    addCommand(commandWord, commandDescription, callback) {
        vorpal
            .command(commandWord, commandDescription)
            .action((vorpalArgs, vorpalCallback) => {
            callback(vorpalArgs, vorpalCallback);
        });
    }
    _setupTaskParameters(vorpalCommand, reloadAll = false) {
        return new Promise((resolve, reject) => {
            let getTaskParametersPromise = []; //Save promises
            //Parameters has not been retrieved before or force reload
            if (this.taskParameters == null || reloadAll) {
                vorpal.log("Loading new parameters from server.");
                getTaskParametersPromise.push(this._getServerTaskParameters());
            }
            //Wait GetParameters function if request needed  
            Promise.all(getTaskParametersPromise).catch(reject).then(() => {
                //Parameters are retrieved: ready to ask values
                if (this.taskParameters == null || this.taskParameters.length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    //Parameters already retrieved
                    let vorpalPrompts = [];
                    //Ask value for each parameters
                    this.taskParameters.forEach((parameter) => {
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): "
                        });
                    });
                    vorpal.log("----------------------------");
                    vorpal.log("Configuring " + this.taskParameters.length + " parameter(s):");
                    vorpalCommand.prompt(vorpalPrompts).then((answers) => {
                        vorpal.log("----------------------------");
                        //Update parameters value
                        this.taskParameters.filter((parameter) => {
                            return answers.hasOwnProperty(parameter.key);
                        }).forEach((parameter) => {
                            if (answers[parameter.key] !== "") //Not empty value
                                parameter.value = answers[parameter.key];
                        });
                        resolve();
                    });
                }
            });
        });
    }
    _getServerTaskParameters() {
        return new Promise((resolve, reject) => {
            this.server.cli["getParameters"]().then((parameters) => {
                this.taskParameters = parameters;
                resolve();
            }).catch(reject);
        });
    }
    _executeDistantCommand(commandName, ...parameters) {
        return new Promise((resolve, reject) => {
            try {
                this.server.cli[commandName](...parameters).then((result) => {
                    resolve(result);
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    _serverInvalidCommandError(e) {
        logger_1.logger.cli().error("Error in command ", e);
    }
}
exports.RemoteCLI = RemoteCLI;
//# sourceMappingURL=RemoteCLI.js.map