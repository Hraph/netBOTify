"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var Client_1 = require("./Client");
var ClientIdentifier_1 = require("../models/ClientIdentifier");
var logger_1 = require("../logger");
var EventEmitter = require("events"), vorpal = require('vorpal')(), cTable = require('console.table');
var RemoteCLI = (function (_super) {
    __extends(RemoteCLI, _super);
    function RemoteCLI(config) {
        var _this = this;
        if (config === void 0) { config = {}; }
        _super.call(this, config); //Create client
        this.globalParameters = null;
        var __this = this; //Keep context
        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientIdentifier_1.ClientType.RemoteCLI;
        try {
            /**
             * Set logger config
             */
            if (config.logger)
                logger_1.logger.setCliLevel(config.logger);
            /**
             * Client internal events handling
             */
            this.client.ready(function (serverProxy) {
                logger_1.logger.cli().info("Connected to server");
                //Auto subscribe config
                if (config.autoSubscribe)
                    vorpal.exec("subscribe");
                //Launch vorpal
                vorpal.show();
            });
            this.client.onConnectionLost(function () {
                logger_1.logger.cli().info("Disconnected to server\n");
                vorpal.hide();
            });
            this.client.onConnect(function () {
                if (_this.client.isReady()) {
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
            /**
             * CLI RPC methods registering
             */
            /**
             * Process when an event is forwarded from the server to the CLI
             * @param {string} eventName: The custom event name
             * @param data: Optional parameters
             * @param {string} token: The client od of the origin worker
             * @constructor
             */
            this.client.exports.CLIOnEvent = function (eventName, data, token) {
                if (data === void 0) { data = null; }
                logger_1.logger.cli().info("EVENT %s (%s):", eventName, token, data); //Print the event with a shorten client id
            };
            /**
             * Vorpal commands definition
             */
            if (!this.config.delimiter)
                this.config.delimiter = "netBOTify"; //Default delimiter
            vorpal.delimiter(this.config.delimiter + '$');
            /**
             * Ping command
             */
            vorpal
                .command('ping', 'Ping the server.')
                .action(function (args, callback) {
                __this._executeDistantCommand("ping").then(function (result) {
                    vorpal.log(result);
                    callback();
                });
            });
            /**
             * Launch task command
             */
            vorpal
                .command('launch [token]', 'Launch the task on workers.')
                .option('-f, --force', "Force sending start even if it's already launched")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .action(function (args, callback) {
                var _this = this;
                var setParametersCommandPromise = [];
                //Parameters has not been retrieved before: SET UP PARAMETERS
                if (__this.globalParameters == null) {
                    vorpal.log("Some global parameters has not been set!");
                    vorpal.log("----------------------------");
                    // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                    setParametersCommandPromise.push(__this._setupTaskParameters(this)); //Relaunch command
                }
                //Parameters has been set
                Promise.all(setParametersCommandPromise).then(function () {
                    // Ask for confirmation
                    //@ts-ignore
                    return _this.prompt({
                        type: 'confirm',
                        name: 'continue',
                        default: false,
                        message: 'Confirm to launch worker(s)?'
                    }, function (result) {
                        if (!result.continue)
                            callback();
                        else
                            __this._executeDistantCommand("launchTask", __this.globalParameters, args.token, args.options) //Execute task with parameters
                                .then(function (result) {
                                vorpal.log("%d worker's task launched of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                                callback();
                            })
                                .catch(__this._serverInvalidCommandError);
                    });
                });
            });
            /**
             * Stop task command
             */
            vorpal
                .command('stop [token]', 'Stop the task on workers.')
                .option('-f, --force', "Force sending stop even if it's already stopped")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .action(function (args, callback) {
                // Ask for confirmation
                //@ts-ignore
                return this.prompt({
                    type: 'confirm',
                    name: 'continue',
                    default: false,
                    message: 'Confirm to stop worker(s)?'
                }, function (result) {
                    if (!result.continue)
                        callback();
                    else
                        __this._executeDistantCommand("stopTask", args.token, args.options)
                            .then(function (result) {
                            vorpal.log("%d worker's task stopped of %d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                });
            });
            /**
             * Parameters setup command
             */
            vorpal
                .command('parameters', 'Manage global parameters sent to all workers.')
                .option("-r, --reload", "Erase and reload the current parameters from the server.")
                .option("-s, --save", "Save parameters value on the server now.")
                .action(function (args, callback) {
                // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                __this._setupTaskParameters(this, args.options.reload).then(function () {
                    if (args.options.save) {
                        __this._executeDistantCommand("saveGlobalParameters", __this.globalParameters)
                            .then(function (result) {
                            vorpal.log("Parameters saved on the server.");
                            callback();
                        })
                            .catch(__this._serverInvalidCommandError);
                    }
                    else
                        callback();
                });
            });
            /**
             * List of connected workers command
             */
            vorpal
                .command('workers [token]', 'Get server connected workers.')
                .option('-g, --groupby <property>', 'Group result by a property')
                .types({
                string: ['g', 'groupby']
            })
                .action(function (args, callback) {
                __this._executeDistantCommand("getWorkers", args.token)
                    .then(function (result) {
                    vorpal.log(result.length + " workers");
                    // Process grouby
                    if (typeof args.options.groupby != "undefined") {
                        var gbResult_1 = __this._objectGroupByProperty(result, args.options.groupby);
                        if (gbResult_1.length > 0) {
                            var gbResultReduced_1 = [];
                            Object.keys(gbResult_1).forEach(function (x) {
                                var obj = {};
                                obj[args.options.groupby] = x;
                                obj["values"] = gbResult_1[x].length,
                                    gbResultReduced_1.push(obj);
                            });
                            console.log(gbResultReduced_1);
                            vorpal.log(cTable.getTable(gbResultReduced_1));
                        }
                    }
                    else if (result.length > 0)
                        vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            /**
             * List of connected CLIs command
             */
            vorpal
                .command('clis [token]', 'Get server connected CLIs.')
                .action(function (args, callback) {
                __this._executeDistantCommand("getCLIs", args.token)
                    .then(function (result) {
                    vorpal.log(result.length + " CLIs");
                    if (result.length > 0)
                        vorpal.log(cTable.getTable(result));
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            /**
             * Subscribe to the server (implicitly worker) events command
             */
            vorpal
                .command('subscribe', 'Subscribe to server worker events.')
                .action(function (args, callback) {
                __this._executeDistantCommand("subscribe")
                    .then(function (result) {
                    vorpal.log("Subscribed to server events");
                    callback();
                })
                    .catch(__this._serverInvalidCommandError);
            });
            /**
             * Unsubscribe to worker events command
             */
            vorpal
                .command('unsubscribe', 'Unsubscribe to server worker events.')
                .action(function (args, callback) {
                __this._executeDistantCommand("unsubscribe")
                    .then(function (result) {
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
    /**
     * Setup the registered global parameters
     * Retrieve parameters on the server on the first setup
     * @param vorpalCommand: Attach the setup to a vorpal command
     * @param {boolean} reloadAll: Get new parameters from server at every calls
     * @returns {Promise<any>}
     * @private
     */
    RemoteCLI.prototype._setupTaskParameters = function (vorpalCommand, reloadAll) {
        var _this = this;
        if (reloadAll === void 0) { reloadAll = false; }
        return new Promise(function (resolve, reject) {
            var getTaskParametersPromise = []; //Save promises
            //Parameters has not been retrieved before or force reload
            if (_this.globalParameters == null || reloadAll) {
                vorpal.log("Loading new parameters from server.");
                getTaskParametersPromise.push(_this._getServerGlobalParameters());
            }
            //Wait GetParameters function if request needed  
            Promise.all(getTaskParametersPromise).catch(reject).then(function () {
                //Parameters are retrieved: ready to ask values
                if (_this.globalParameters == null || Object.keys(_this.globalParameters).length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    //Parameters already retrieved
                    var vorpalPrompts = [];
                    //Ask value for each parameters
                    for (var parameterKey in _this.globalParameters) {
                        var parameter = _this.globalParameters[parameterKey];
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): "
                        });
                    }
                    ;
                    vorpal.log("----------------------------");
                    vorpal.log("Configuring " + Object.keys(_this.globalParameters).length + " parameter(s):");
                    vorpalCommand.prompt(vorpalPrompts).then(function (answers) {
                        vorpal.log("----------------------------");
                        //Update parameters value
                        for (var answerKey in answers) {
                            if (_this.globalParameters.hasOwnProperty(answerKey) && answers[answerKey] !== "")
                                _this.globalParameters[answerKey].value = answers[answerKey];
                        }
                        resolve();
                    });
                }
            });
        });
    };
    /**
     * Get the registered parameters on the server
     * @returns {Promise<any>}
     * @private
     */
    RemoteCLI.prototype._getServerGlobalParameters = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.server.cli["getGlobalParameters"]().then(function (parameters) {
                _this.globalParameters = parameters;
                resolve();
            }).catch(reject);
        });
    };
    /**
     * Execute a CLI command on the server
     * @param {string} commandName
     * @param parameters
     * @returns {Promise<any>}
     * @private
     */
    RemoteCLI.prototype._executeDistantCommand = function (commandName) {
        var _this = this;
        var parameters = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            parameters[_i - 1] = arguments[_i];
        }
        return new Promise(function (resolve, reject) {
            try {
                (_a = _this.server.cli)[commandName].apply(_a, parameters).then(function (result) {
                    resolve(result);
                });
            }
            catch (e) {
                reject(e);
            }
            var _a;
        });
    };
    RemoteCLI.prototype._objectGroupByProperty = function (obj, prop) {
        return obj.reduce(function (rv, x) {
            (rv[x[prop]] = rv[x[prop]] || []).push(x);
            return rv;
        }, {});
    };
    /**
     * Error handler to invalid command
     * @param e
     * @private
     */
    RemoteCLI.prototype._serverInvalidCommandError = function (e) {
        logger_1.logger.cli().error("Error in command ", e);
    };
    /**
     * Add a custom command to the CLI
     * @param {string} commandWord
     * @param {string} commandDescription
     * @param {(args: any, endCommand: Function) => void} callback
     */
    RemoteCLI.prototype.addCommand = function (commandWord, commandDescription, callback) {
        vorpal
            .command(commandWord, commandDescription)
            .action(function (vorpalArgs, vorpalCallback) {
            callback(vorpalArgs, vorpalCallback);
        });
    };
    /**
     * Get the cli logger using set configuration
     * @returns {Logger}
     */
    RemoteCLI.prototype.logger = function () {
        return logger_1.logger.cli();
    };
    return RemoteCLI;
}(Client_1.Client));
exports.RemoteCLI = RemoteCLI;
