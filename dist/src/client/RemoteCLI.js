"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Client_1 = require("./Client");
const ClientIdentifier_1 = require("../models/ClientIdentifier");
const logger_1 = require("../utils/logger");
const utils_1 = require("../utils/utils");
const EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
class RemoteCLI extends Client_1.Client {
    constructor(config = {}) {
        super(config);
        this.taskParameters = null;
        this.task = {
            onTaskResult: (callback) => {
                this.cliEvent.on("event:taskResult", callback);
            },
            onTaskError: (callback) => {
                this.cliEvent.on("event:taskError", callback);
            }
        };
        this.tunnel = {
            onTunnelError: (callback) => {
                this.cliEvent.on("event:tunnelError", callback);
            }
        };
        this.events = {
            onEvent: (eventName, callback) => {
                this.cliEvent.on("event:" + eventName, callback);
            },
            onAnyEvent: (callback) => {
                this.cliEvent.on("event", callback);
            }
        };
        this.customize = {
            addCommand: (commandWord, commandDescription, callback, options) => {
                let command = vorpal
                    .command(commandWord, commandDescription)
                    .action((vorpalArgs, vorpalCallback) => {
                    callback(vorpalArgs, vorpalCallback);
                });
                if (options != null) {
                    options.forEach(x => (x.key != null && x.description != null) ? command.option(x.key, x.description) : null);
                }
            },
            getVorpalInstance: () => {
                return vorpal;
            }
        };
        let __this = this;
        this.cliEvent = new EventEmitter();
        this.identifier.clientType = ClientIdentifier_1.ClientType.RemoteCLI;
        try {
            if (config.logger)
                logger_1.logger.setCliLevel(config.logger);
            this.client.ready((serverProxy) => {
                logger_1.logger.cli().info("Connected to server");
                if (config.autoSubscribe)
                    vorpal.exec("subscribe");
                if (!config.disableInput)
                    vorpal.show();
            });
            this.client.onConnectionLost(() => {
                logger_1.logger.cli().info("Disconnected to server\n");
                if (!config.disableInput)
                    vorpal.hide();
            });
            this.client.onConnect(() => {
                if (this.client.isReady()) {
                    logger_1.logger.cli().info("Reconnected to server\n");
                    if (!config.disableInput)
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
            this.client.exports.onEvent = function (eventName, data = null, token) {
                logger_1.logger.cli().trace("EVENT %s (%s)", eventName, token);
                __this.cliEvent.emit("event", eventName, data, token);
                __this.cliEvent.emit("event:" + eventName, data, token);
            };
            if (!this.config.delimiter)
                this.config.delimiter = "netBOTify";
            vorpal.delimiter(this.config.delimiter + '$');
            vorpal
                .command('ping', 'Ping the server.')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.ping, true).then((result) => {
                    vorpal.log(result);
                    callback();
                });
            });
            vorpal
                .command('task status [token]', 'Get status from worker')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .action(function (args, callback) {
                if (args.options.where != null) {
                    vorpal.log("Caution: custom filter is used!");
                    if (!args.options.where.includes("=")) {
                        vorpal.log("Invalid where filter");
                    }
                }
                __this._executeDistantCommand(__this.server.task.status.get, args.token, args.options)
                    .then((result) => {
                    if (result.statuses != null && result.statuses.length > 0) {
                        if (args.options.groupby != null)
                            vorpal.log(cTable.getTable(utils_1.objectGroupByPropertyAndCount(result.statuses, args.options.groupby)));
                        else
                            vorpal.log(cTable.getTable(result.statuses));
                    }
                    vorpal.log("got status of %d/%d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('task launch [token]', 'Launch the task on workers.')
                .option('-f, --force', "Force sending start even if it's already launched")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .action(function (args, callback) {
                let setParametersCommandPromise = [];
                if (__this.taskParameters == null) {
                    vorpal.log("Some global parameters has not been set!");
                    vorpal.log("----------------------------");
                    setParametersCommandPromise.push(__this._setupTaskParameters(this));
                }
                Promise.all(setParametersCommandPromise).then(() => {
                    if (args.options.where != null) {
                        vorpal.log("Caution: custom filter is used!");
                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                    }
                    return this.prompt({
                        type: 'confirm',
                        name: 'continue',
                        default: false,
                        message: 'Confirm to launch worker(s)?',
                    }, (result) => {
                        if (!result.continue)
                            callback();
                        else
                            __this._executeDistantCommand(__this.server.task.launch, __this.taskParameters, args.token, args.options)
                                .then((result) => {
                                vorpal.log("%d worker's task launched of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                                callback();
                            })
                                .catch(__this._serverInvalidCommandError);
                    });
                });
            });
            vorpal
                .command('task stop [token]', 'Stop the task on workers.')
                .option('-f, --force', "Force sending stop even if it's already stopped")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .action(function (args, callback) {
                if (args.options.where != null) {
                    vorpal.log("Caution: custom filter is used!");
                    if (!args.options.where.includes("=")) {
                        vorpal.log("Invalid where filter");
                    }
                }
                return this.prompt({
                    type: 'confirm',
                    name: 'continue',
                    default: false,
                    message: 'Confirm to stop worker(s)?',
                }, (result) => {
                    if (!result.continue)
                        callback();
                    else
                        __this._executeDistantCommand(__this.server.task.stop, args.token, args.options)
                            .then((result) => {
                            vorpal.log("%d worker's task stopped of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                });
            });
            vorpal
                .command('task parameters', 'Manage task parameters sent to all workers.')
                .option("-r, --reload", "Erase and reload the current parameters from the server.")
                .option("-s, --save", "Save parameters value on the server now.")
                .action(function (args, callback) {
                __this._setupTaskParameters(this, args.options.reload).then(() => {
                    if (args.options.save) {
                        __this._executeDistantCommand(__this.server.task.parameters.save, __this.taskParameters)
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
                .command('tunnel create <token> <port>', 'Create a tunnel on a worker.')
                .option('--http', "Use http protocol")
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.tunnel.create, args.token, args.port, args.options.http ? false : true)
                    .then((result) => {
                    vorpal.log("%d tunnel created for the worker %s", result.length, args.token);
                    vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('tunnel stop [token] <port>', 'Stop a tunnel on all or a specific worker.')
                .action(function (args, callback) {
                return __awaiter(this, void 0, void 0, function* () {
                    let confirm = true;
                    if (args.token == null) {
                        let res = yield this.prompt({
                            type: 'confirm',
                            name: 'continue',
                            default: false,
                            message: `Confirm to stop tunnel(s) on all workers for port ${args.port} ?`,
                        });
                        confirm = res.continue;
                    }
                    if (confirm) {
                        __this._executeDistantCommand(__this.server.tunnel.stop, args.token, args.port)
                            .then((result) => {
                            vorpal.log("%d tunnel%s stopped", result.success, (result.success >= 2) ? "s" : "");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                    }
                    else
                        callback();
                });
            });
            vorpal
                .command('tunnel kill [token]', 'Stop a tunnel on all or a specific worker.')
                .action(function (args, callback) {
                return __awaiter(this, void 0, void 0, function* () {
                    let confirm = true;
                    if (args.token == null) {
                        let res = yield this.prompt({
                            type: 'confirm',
                            name: 'continue',
                            default: false,
                            message: 'Confirm to kill tunnel(s) on all workers?',
                        });
                        confirm = res.continue;
                    }
                    if (confirm) {
                        __this._executeDistantCommand(__this.server.tunnel.stop, args.token, 0, true)
                            .then((result) => {
                            vorpal.log("%d tunnel%s killed", result.success, (result.success >= 2) ? "s" : "");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                    }
                    else
                        callback();
                });
            });
            vorpal
                .command('tunnel get [token]', 'Get tunnels on a all or specific worker.')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.tunnel.get, args.token)
                    .then((result) => {
                    vorpal.log("%d tunnel%s", result.length, (result.length >= 2) ? "s" : "");
                    vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('workers [token]', 'Get server connected workers.')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.cli.getWorkers, args.token)
                    .then((result) => {
                    if (args.options.where) {
                        vorpal.log("Caution: custom filter is used!");
                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                        else {
                            let where = args.options.where.split("=");
                            let key = where[0].trim();
                            let filter = where[1].replace(/'/gi, "").trim();
                            result = result.filter((x) => x[key] == filter);
                        }
                    }
                    vorpal.log(result.length + " workers");
                    if (!args.options.count && args.options.groupby)
                        vorpal.log(cTable.getTable(utils_1.objectGroupByPropertyAndCount(result, args.options.groupby)));
                    else if (!args.options.count && result.length > 0)
                        vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('workers identities [token]', 'Get server connected workers identities.')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action(function (args, callback) {
                __this._executeDistantCommand(__this.server.cli.getWorkersIdentities, args.token)
                    .then((result) => {
                    if (args.options.where) {
                        vorpal.log("Caution: custom filter is used!");
                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                        else {
                            let where = args.options.where.split("=");
                            let key = where[0].trim();
                            let filter = where[1].replace(/'/gi, "").trim();
                            result = result.filter((x) => x[key] == filter);
                        }
                    }
                    vorpal.log(result.length + " identities");
                    if (!args.options.count && args.options.groupby)
                        vorpal.log(cTable.getTable(utils_1.objectGroupByPropertyAndCount(result, args.options.groupby)));
                    else if (!args.options.count && result.length > 0)
                        vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('clis [token]', 'Get server connected CLIs.')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.cli.getCLIs, args.token)
                    .then((result) => {
                    if (args.options.where) {
                        vorpal.log("Caution: custom filter is used!");
                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                        else {
                            let where = args.options.where.split("=");
                            let key = where[0].trim();
                            let filter = where[1].replace(/'/gi, "").trim();
                            result = result.filter((x) => x[key] == filter);
                        }
                    }
                    vorpal.log(result.length + " CLIs");
                    if (!args.options.count && args.options.groupby)
                        vorpal.log(cTable.getTable(utils_1.objectGroupByPropertyAndCount(result, args.options.groupby)));
                    else if (!args.options.count && result.length > 0)
                        vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('subscribe', 'Subscribe to server worker events.')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.cli.subscribe)
                    .then((result) => {
                    vorpal.log("Subscribed to server events");
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            vorpal
                .command('unsubscribe', 'Unsubscribe to server worker events.')
                .action((args, callback) => {
                __this._executeDistantCommand(__this.server.cli.unsubscribe)
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
            if (this.taskParameters == null || reloadAll) {
                vorpal.log("Loading new parameters from server.");
                getTaskParametersPromise.push(this._getServerTaskParameters());
            }
            Promise.all(getTaskParametersPromise).catch(reject).then(() => {
                if (this.taskParameters == null || Object.keys(this.taskParameters).length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    let vorpalPrompts = [];
                    for (let parameterKey in this.taskParameters) {
                        let parameter = this.taskParameters[parameterKey];
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): "
                        });
                    }
                    ;
                    vorpal.log("----------------------------");
                    vorpal.log("Configuring " + Object.keys(this.taskParameters).length + " parameter(s):");
                    vorpalCommand.prompt(vorpalPrompts).then((answers) => {
                        vorpal.log("----------------------------");
                        for (let answerKey in answers) {
                            if (this.taskParameters.hasOwnProperty(answerKey) && answers[answerKey] !== "")
                                this.taskParameters[answerKey].value = answers[answerKey];
                        }
                        resolve();
                    });
                }
            });
        });
    }
    _getServerTaskParameters() {
        return new Promise((resolve, reject) => {
            this.server.task.parameters["get"]().then((parameters) => {
                this.taskParameters = parameters;
                resolve();
            }).catch(reject);
        });
    }
    _executeDistantCommand(command, ...parameters) {
        return new Promise((resolve, reject) => {
            try {
                command(...parameters).then((result) => {
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
    logger() {
        return logger_1.logger.cli();
    }
}
exports.RemoteCLI = RemoteCLI;
//# sourceMappingURL=RemoteCLI.js.map