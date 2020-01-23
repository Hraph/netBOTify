import {Client} from "./Client";
import {ClientType} from "../models/ClientIdentifier";
import {logger} from "../utils/logger";
import {TaskParameterList} from "../models/TaskParameters";
import {RemoteCLIConfig} from "../models/RemoteCLIConfig";
import {Logger} from "log4js";
import {objectGroupByPropertyAndCount} from "../utils/utils";

const EventEmitter = require("events"),
      vorpal = require('vorpal')(),
      cTable = require('console.table');

/** @ignore */
declare var require: any;


export class RemoteCLI extends Client {
    private cliEvent: any;
    private taskParameters: any = null;
    constructor(config: RemoteCLIConfig = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.cliEvent = new EventEmitter();
        this.identifier.clientType = ClientType.RemoteCLI;
        
        try {
            /**
             * Set logger config
             */
            if (config.logger)
                logger.setCliLevel(config.logger);
                
            /**
             * Client internal events handling
             */
            this.client.ready((serverProxy: any) => {
                logger.cli().info("Connected to server");
    
                //Auto subscribe config
                if (config.autoSubscribe)
                    vorpal.exec("subscribe");
                    
                //Launch vorpal
                if (!config.disableInput)
                    vorpal.show();
            });
    
            this.client.onConnectionLost(() => {
                logger.cli().info("Disconnected to server\n");

                if (!config.disableInput)
                    vorpal.hide();
            });
    
            this.client.onConnect(() => {
                if (this.client.isReady()) { //Client was ready but is now reconnecting : relaunch vorpal
                    logger.cli().info("Reconnected to server\n");

                    if (!config.disableInput)
                        vorpal.show();
                }
            });
    
            this.client.onError(function (e: any) {
                if (e.type === "TransportError") {
                    logger.cli().error("Unable to connect to server: code", e.description);
                }
                else {
                    logger.cli().error('Unknown error', e);
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
            this.client.exports.onEvent = function(eventName: string, data: any = null, token: string) {
                logger.cli().trace("EVENT %s (%s)", eventName, token); //Print the event with a shorten client id

                __this.cliEvent.emit("event", eventName, data, token); // Emit local event for any
                __this.cliEvent.emit("event:" + eventName, data, token); // Emit local event
            };
    
    
            /**
             * Vorpal commands definition
             */
            if (!this.config.delimiter) this.config.delimiter = "netBOTify"; //Default delimiter
            vorpal.delimiter(this.config.delimiter + '$');
    
            /**
             * Ping command
             */
            vorpal
                .command('ping', 'Ping the server.')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.ping, true).then((result: any) => {
                        vorpal.log(result);
                        callback();
                    });
                });

            /**
             * Task status command
             */
            vorpal
                .command('task status [token]', 'Get status from worker')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .action(function(args: any, callback: Function) {
                    // Process where
                    if (args.options.where != null) {
                        vorpal.log("Caution: custom filter is used!");

                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                    }

                    __this._executeDistantCommand(__this.server.task.status.get, args.token, args.options)
                        .then((result: any) => {
                            if (result.statuses != null && result.statuses.length > 0) { // Has result

                                // Process groubpy
                                if (args.options.groupby != null)
                                    vorpal.log(cTable.getTable(objectGroupByPropertyAndCount(result.statuses, args.options.groupby)));

                                else
                                    vorpal.log(cTable.getTable(result.statuses));

                            }

                            vorpal.log("got status of %d/%d worker%s. %d error%s", result.success, result.total, (result.total >= 2) ? "s" : "", result.errors, (result.errors >= 2) ? "s" : "");
                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);


                });
    
            /**
             * Launch task command
             */
            vorpal
                .command('task launch [token]', 'Launch the task on workers.')
                .option('-f, --force', "Force sending start even if it's already launched")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .action(function(args: any, callback: Function) {
                    let setParametersCommandPromise = [];
                    
                    //Parameters has not been retrieved before: SET UP PARAMETERS
                    if (__this.taskParameters == null) {
                        vorpal.log("Some global parameters has not been set!");
                        vorpal.log("----------------------------");
                        
                        // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                        setParametersCommandPromise.push(__this._setupTaskParameters(this)); //Relaunch command
                    }
                    
                    //Parameters has been set
                    Promise.all(setParametersCommandPromise).then(() => {
                        // Process where
                        if (args.options.where != null) {
                            vorpal.log("Caution: custom filter is used!");

                            if (!args.options.where.includes("=")) {
                                vorpal.log("Invalid where filter");
                            }
                        }

                        // Ask for confirmation
                        //@ts-ignore
                        return this.prompt({
                            type: 'confirm',
                            name: 'continue',
                            default: false,
                            message: 'Confirm to launch worker(s)?',
                        }, (result: any) => {
                            if (!result.continue) // Abort
                                callback();
                            else // Confirm
                                __this._executeDistantCommand(__this.server.task.launch, __this.taskParameters, args.token, args.options)  //Execute task with parameters
                                    .then((result: any) => {
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
                .command('task stop [token]', 'Stop the task on workers.')
                .option('-f, --force', "Force sending stop even if it's already stopped")
                .option('-l, --limit <amount>', 'Restrict to a certain amount of workers')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .action(function(args: any, callback: Function) {
                    // Process where
                    if (args.options.where != null) {
                        vorpal.log("Caution: custom filter is used!");

                        if (!args.options.where.includes("=")) {
                            vorpal.log("Invalid where filter");
                        }
                    }

                    // Ask for confirmation
                    //@ts-ignore
                    return this.prompt({
                        type: 'confirm',
                        name: 'continue',
                        default: false,
                        message: 'Confirm to stop worker(s)?',
                    }, (result: any) => {
                        if (!result.continue) // Abort
                            callback();
                        else // Confirm
                            __this._executeDistantCommand(__this.server.task.stop, args.token, args.options)
                                .then((result: any) => {
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
                .command('task parameters', 'Manage task parameters sent to all workers.')
                .option("-r, --reload", "Erase and reload the current parameters from the server.")
                .option("-s, --save", "Save parameters value on the server now.")
                .action(function(args: any, callback: Function) {
                    // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                    __this._setupTaskParameters(this, args.options.reload).then(() => {
                        if (args.options.save) {
                            __this._executeDistantCommand(__this.server.task.parameters.save, __this.taskParameters)
                                .then((result: any) => {
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
             * Create a tunnel on worker
             */
            vorpal
                .command('tunnel create <token> <port>', 'Create a tunnel on a worker.')
                .option('--http', "Use http protocol")
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.tunnel.create, args.token, args.port, args.options.http ? false : true)
                        .then((result: any) => {
                            vorpal.log("%d tunnel created for the worker %s", result.length, args.token);
                            vorpal.log(cTable.getTable(result));

                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);
                });

            /**
             * Stop a tunnel on worker
             */
            vorpal
                .command('tunnel stop <token> <port>', 'Stop a tunnel on a worker.')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.tunnel.stop, args.token, args.port)
                        .then((result: any) => {
                            vorpal.log("%d tunnel%s stopped", result.success, (result.success >= 2) ? "s" : "");

                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);
                });

            /**
             * Kill all tunnels on worker
             */
            vorpal
                .command('tunnel kill <token>', 'Stop a tunnel on a worker.')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.tunnel.stop, args.token, 0, true)
                        .then((result: any) => {
                            vorpal.log("%d tunnel%s stopped", result.success, (result.success >= 2) ? "s" : "");

                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);
                });

            /**
             * List of opened tunnels on worker
             */
            vorpal
                .command('tunnel get <token>', 'Get tunnels on a worker.')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.tunnel.get, args.token)
                        .then((result: any) => {
                            vorpal.log("%d tunnel%s for the worker %s", result.length, (result.length >= 2) ? "s" : "", args.token);

                            vorpal.log(cTable.getTable(result));

                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);
                });

            /**
             * List of connected workers command
             */
            vorpal
                .command('workers [token]', 'Get server connected workers.')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.cli.getWorkers, args.token)
                        .then((result: any) => {
                            // Process where
                            if (args.options.where){
                                vorpal.log("Caution: custom filter is used!");

                                if (!args.options.where.includes("=")) {
                                    vorpal.log("Invalid where filter");
                                }
                                else {
                                    let where: any = args.options.where.split("=");
                                    let key: string = where[0].trim();
                                    let filter: string = where[1].replace(/'/gi, "").trim(); // filter is surrounded with quotes involuntary by vorpal

                                    result = result.filter((x: any) => x[key] == filter);
                                }
                            }
                            
                            vorpal.log(result.length + " workers");

                            // Process grouby
                            if (!args.options.count && args.options.groupby)
                                vorpal.log(cTable.getTable(objectGroupByPropertyAndCount(result, args.options.groupby)));

                            else if (!args.options.count && result.length > 0) // No options
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
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.cli.getCLIs, args.token)
                        .then((result: any) => {
                            // Process where
                            if (args.options.where){
                                vorpal.log("Caution: custom filter is used!");

                                if (!args.options.where.includes("=")) {
                                    vorpal.log("Invalid where filter");
                                }
                                else {
                                    let where: any = args.options.where.split("=");
                                    let key: string = where[0].trim();
                                    let filter: string = where[1].replace(/'/gi, "").trim(); // filter is surrounded with quotes involuntary by vorpal

                                    result = result.filter((x: any) => x[key] == filter);
                                }
                            }
                            
                            vorpal.log(result.length + " CLIs");
                            
                            // Process grouby
                            if (!args.options.count && args.options.groupby)
                                vorpal.log(cTable.getTable(objectGroupByPropertyAndCount(result, args.options.groupby)));
                                
                            else if (!args.options.count && result.length > 0) // No options
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
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.cli.subscribe)
                        .then((result: any) => {
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
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand(__this.server.cli.unsubscribe)
                        .then((result: any) => {
                            vorpal.log("Unsubscribed to server events");
                            callback();
                        })
                        .catch(__this._serverInvalidCommandError);
                });
        }
        catch(e) {
            logger.cli().error("Error while constructing cli: " + e);
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
    private _setupTaskParameters(vorpalCommand: any, reloadAll: boolean = false){
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
                
                if (this.taskParameters == null || Object.keys(this.taskParameters).length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    //Parameters already retrieved
                    let vorpalPrompts: any = [];
                        
                    //Ask value for each parameters
                    for (let parameterKey in this.taskParameters) {
                        let parameter = this.taskParameters[parameterKey];
                        
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): " 
                        });
                    };
                    
                    vorpal.log("----------------------------");

                    vorpal.log("Configuring " + Object.keys(this.taskParameters).length + " parameter(s):");
                    
                    vorpalCommand.prompt(vorpalPrompts).then((answers: any) => {
                        vorpal.log("----------------------------");
                        
                        //Update parameters value
                        for (let answerKey in answers) {
                            if (this.taskParameters.hasOwnProperty(answerKey) && answers[answerKey] !== "") //Parameter exist and not empty parameter
                                this.taskParameters[answerKey].value = answers[answerKey];
                        }
                        
                        resolve();
                    });
                }
                
            }); 
        });
    }

    /**
     * Get the registered parameters on the server
     * @returns {Promise<any>}
     * @private
     */
    private _getServerTaskParameters(){
        return new Promise((resolve, reject) => {
            this.server.task.parameters["get"]().then((parameters: TaskParameterList) => {
                this.taskParameters = parameters;
                resolve();
            }).catch(reject);
        })
    }

    /**
     * Execute a CLI command on the server
     * @param {string} commandName
     * @param parameters
     * @returns {Promise<any>}
     * @private
     */
    private _executeDistantCommand(command: Function, ...parameters: any[]){
        return new Promise((resolve, reject) => {
            try {
                command(...parameters).then((result: any) => {
                    resolve(result);
                });
            }
            catch(e){
                reject(e);
            }
        });
    }

    /**
     * Error handler to invalid command
     * @param e
     * @private
     */
    private _serverInvalidCommandError(e: any){
        logger.cli().error("Error in command ", e);
    }

    /**
     * Get the cli logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.cli();
    }

    /**
     * Public methods for Task control
     */
    public task = {
        /**
         * Add handler on task result event
         * @param {(result: any, workerToken: string) => void} callback
         */
        onTaskResult: (callback: (result: any, workerToken: string) => void) => {
            this.cliEvent.on("event:taskResult", callback);
        },
        /**
         * Add handler on task error event
         * @param callback
         */
        onTaskError: (callback: (error: any, workerToken: string) => void) => {
            this.cliEvent.on("event:taskError", callback);
        }
    };

    /**
     * Public methods for Tunnel
     */
    public tunnel = {
        /**
         * Add handler on tunnel error event
         * @param callback
         */
        onTunnelError: (callback: (error: any, workerToken: string) => void) => {
            this.cliEvent.on("event:tunnelError", callback);
        }
    };

    /**
     * Public methods for events
     */
    public events = {
        /**
         * Add handler on custom event
         * @param {string} eventName
         * @param {(data: any, workerToken: string) => void} callback
         */
        onEvent: (eventName: string, callback: (data: any, workerToken: string) => void) => {
            this.cliEvent.on("event:" + eventName, callback);
        },
        /**
         * Add handler on any event
         * @param callback
         */
        onAnyEvent: (callback: (eventName: string, data: any, workerToken: string) => void) => {
            this.cliEvent.on("event", callback);
        }
    };

    /**
     * Public methods for customization
     */
    public customize = {
        /**
         * Add a custom command to the CLI
         * @param {string} commandWord
         * @param {string} commandDescription
         * @param {(args: any, endCommand: Function) => void} callback
         */
        addCommand: (commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void, options?: [{key: string, description: string}]) => {
            let command = vorpal
                .command(commandWord, commandDescription)
                .action((vorpalArgs: any, vorpalCallback: Function) => {
                    callback(vorpalArgs, vorpalCallback);
                });

            if (options != null){
                options.forEach(x => (x.key != null && x.description != null) ? command.option(x.key, x.description) : null); // Apply options
            }
        }
    }
}