"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../logger");
const EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
class RemoteCLI extends Client_1.Client {
    constructor(config = {}) {
        super(config);
        this.globalParameters = null;
        let __this = this;
        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientIdentifier_1.ClientType.RemoteCLI;
        try {
            if (config.logger)
                logger_1.logger.setCliLevel(config.logger);
            this.client.ready((serverProxy) => {
                logger_1.logger.cli().info("Connected to server");
                if (config.autoSubscribe)
                    vorpal.exec("subscribe");
                vorpal.show();
            });
            this.client.onConnectionLost(() => {
                logger_1.logger.cli().info("Disconnected to server\n");
                vorpal.hide();
            });
            this.client.onConnect(() => {
                if (this.client.isReady()) {
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
            this.client.exports.CLIOnEvent = function (eventName, data = null, clientId) {
                logger_1.logger.cli().info("EVENT %s (%s):", eventName, clientId.substr(0, 5), data);
            };
            if (!this.config.delimiter)
                this.config.delimiter = "netBOTify";
            vorpal.delimiter(this.config.delimiter + '$');
            vorpal
                .command('ping', 'Ping the server.')
                .action((args, callback) => {
                __this._executeDistantCommand("ping").then((result) => {
                    vorpal.log(result);
                    callback();
                });
            });
            vorpal
                .command('launch [clientId]', 'Launch the task on workers.')
                .option('-f, --force', "Force sending start even if it's already launched")
                .action(function (args, callback) {
                let setParametersCommandPromise = [];
                if (__this.globalParameters == null) {
                    vorpal.log("Some global parameters has not been set!");
                    vorpal.log("----------------------------");
                    setParametersCommandPromise.push(__this._setupTaskParameters(this));
                }
                Promise.all(setParametersCommandPromise).then(() => {
                    return this.prompt({
                        type: 'confirm',
                        name: 'continue',
                        default: false,
                        message: 'Confirm to launch worker(s)?',
                    }, (result) => {
                        if (!result.continue)
                            callback();
                        else
                            __this._executeDistantCommand("launchTask", __this.globalParameters, args.clientId, args.options.force)
                                .then((result) => {
                                vorpal.log("%d worker's task launched of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                                callback();
                            })
                                .catch(__this._serverInvalidCommandError);
                    });
                });
            });
            vorpal
                .command('stop [clientId]', 'Stop the task on workers.')
                .option('-f, --force', "Force sending stop even if it's already stopped")
                .action(function (args, callback) {
                return this.prompt({
                    type: 'confirm',
                    name: 'continue',
                    default: false,
                    message: 'Confirm to stop worker(s)?',
                }, (result) => {
                    if (!result.continue)
                        callback();
                    else
                        __this._executeDistantCommand("stopTask", args.clientId, args.options.force)
                            .then((result) => {
                            vorpal.log("%d worker's task stopped of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                });
            });
            vorpal
                .command('parameters', 'Manage global parameters sent to all workers.')
                .option("-r, --reload", "Erase and reload the current parameters from the server.")
                .option("-s, --save", "Save parameters value on the server now.")
                .action(function (args, callback) {
                __this._setupTaskParameters(this, args.options.reload).then(() => {
                    if (args.options.save) {
                        __this._executeDistantCommand("saveGlobalParameters", __this.globalParameters)
                            .then((result) => {
                            vorpal.log("Parameters saved on the server.");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                    }
                    else
                        callback();
                });
            });
            vorpal
                .command('workers [clientId]', 'Get server connected workers.')
                .action((args, callback) => {
                __this._executeDistantCommand("getWorkers", args.clientId)
                    .then((result) => {
                    vorpal.log(result.length + " workers");
                    vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('clis [clientId]', 'Get server connected CLIs.')
                .action((args, callback) => {
                __this._executeDistantCommand("getCLIs", args.clientId)
                    .then((result) => {
                    vorpal.log(result.length + " CLIs");
                    vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('subscribe', 'Subscribe to server worker events.')
                .action((args, callback) => {
                __this._executeDistantCommand("subscribe")
                    .then((result) => {
                    vorpal.log("Subscribed to server events");
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('unsubscribe', 'Unsubscribe to server worker events.')
                .action((args, callback) => {
                __this._executeDistantCommand("unsubscribe")
                    .then((result) => {
                    vorpal.log("Unsubscribed to server events");
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
        }
        catch (e) {
            logger_1.logger.cli().error("Error while constructing cli: " + e);
            process.exit(1);
        }
    }
    _setupTaskParameters(vorpalCommand, reloadAll = false) {
        return new Promise((resolve, reject) => {
            let getTaskParametersPromise = [];
            if (this.globalParameters == null || reloadAll) {
                vorpal.log("Loading new parameters from server.");
                getTaskParametersPromise.push(this._getServerGlobalParameters());
            }
            Promise.all(getTaskParametersPromise).catch(reject).then(() => {
                if (this.globalParameters == null || Object.keys(this.globalParameters).length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    let vorpalPrompts = [];
                    for (let parameterKey in this.globalParameters) {
                        let parameter = this.globalParameters[parameterKey];
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): "
                        });
                    }
                    ;
                    vorpal.log("----------------------------");
                    vorpal.log("Configuring " + Object.keys(this.globalParameters).length + " parameter(s):");
                    vorpalCommand.prompt(vorpalPrompts).then((answers) => {
                        vorpal.log("----------------------------");
                        for (let answerKey in answers) {
                            if (this.globalParameters.hasOwnProperty(answerKey) && answers[answerKey] !== "")
                                this.globalParameters[answerKey].value = answers[answerKey];
                        }
                        resolve();
                    });
                }
            });
        });
    }
    _getServerGlobalParameters() {
        return new Promise((resolve, reject) => {
            this.server.cli["getGlobalParameters"]().then((parameters) => {
                this.globalParameters = parameters;
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
    addCommand(commandWord, commandDescription, callback) {
        vorpal
            .command(commandWord, commandDescription)
            .action((vorpalArgs, vorpalCallback) => {
            callback(vorpalArgs, vorpalCallback);
        });
    }
    logger() {
        return logger_1.logger.cli();
    }
}
exports.RemoteCLI = RemoteCLI;
//# sourceMappingURL=RemoteCLI.js.map