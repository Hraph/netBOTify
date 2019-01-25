import {Client} from "./Client";
import {ClientIdentifier, ClientType, TaskStatus} from "../models/ClientIdentifier";
import {logger} from "../logger";
import {GlobalParameter, GlobalParameterList} from "../models/GlobalParameter";
import {RemoteCLIConfig} from "../models/RemoteCLIConfig";
import {Logger} from "log4js";

const EventEmitter = require("events"),
      vorpal = require('vorpal')(),
      cTable = require('console.table');

/** @ignore */
declare var require: any;


export class RemoteCLI extends Client {
    private taskEvent: any;
    private globalParameters: any = null;
    constructor(config: RemoteCLIConfig = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.taskEvent = new EventEmitter();
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
                vorpal.show();
            });
    
            this.client.onConnectionLost(() => {
                logger.cli().info("Disconnected to server\n");
                vorpal.hide();
            });
    
            this.client.onConnect(() => {
                if (this.client.isReady()) { //Client was ready but is now reconnecting : relaunch vorpal
                    logger.cli().info("Reconnected to server\n");
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
            this.client.exports.CLIOnEvent = function(eventName: string, data: any = null, token: string) {
                logger.cli().info("EVENT %s (%s):", eventName, token, data); //Print the event with a shorten client id
            }
    
    
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
                    __this._executeDistantCommand("ping").then((result: any) => {
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
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .action(function(args: any, callback: Function) {
                    let setParametersCommandPromise = [];
                    
                    //Parameters has not been retrieved before: SET UP PARAMETERS
                    if (__this.globalParameters == null) {
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
                                __this._executeDistantCommand("launchTask", __this.globalParameters, args.token, args.options)  //Execute task with parameters
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
                .command('stop [token]', 'Stop the task on workers.')
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
                            __this._executeDistantCommand("stopTask", args.token, args.options)
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
                .command('parameters', 'Manage global parameters sent to all workers.')
                .option("-r, --reload", "Erase and reload the current parameters from the server.")
                .option("-s, --save", "Save parameters value on the server now.")
                .action(function(args: any, callback: Function) {
                    // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                    __this._setupTaskParameters(this, args.options.reload).then(() => {
                        if (args.options.save) {
                            __this._executeDistantCommand("saveGlobalParameters", __this.globalParameters)
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
             * List of connected workers command
             */
            vorpal
                .command('workers [token]', 'Get server connected workers.')
                .option('-w, --where <filter>', 'Find a certain value of a property')
                .option('-g, --groupby <property>', 'Group result by a property')
                .option('-c, --count', 'Count only')
                .action((args: any, callback: Function) => {
                    __this._executeDistantCommand("getWorkers", args.token)
                        .then((result: any) => {
                            // Process where
                            if (args.options.where){
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
                            if (!args.options.count && args.options.groupby) {
                                let gbResult = __this._objectGroupByProperty(result, args.options.groupby);

                                if (Object.keys(gbResult).length > 0){ // Has result: format
                                    let gbResultReduced: any = [];
                                    
                                    Object.keys(gbResult).forEach(x => { // Create value object
                                        let obj: any = {};
                                        obj[args.options.groupby] = x;
                                        obj["values"] = gbResult[x].length,
                                        gbResultReduced.push(obj);
                                    });
                                    vorpal.log(cTable.getTable(gbResultReduced));
                                }
                            }
                                
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
                    __this._executeDistantCommand("getCLIs", args.token)
                        .then((result: any) => {
                            // Process where
                            if (args.options.where){
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
                            if (!args.options.count && args.options.groupby) {
                                let gbResult = __this._objectGroupByProperty(result, args.options.groupby);

                                if (Object.keys(gbResult).length > 0){ // Has result: format
                                    let gbResultReduced: any = [];
                                    
                                    Object.keys(gbResult).forEach(x => { // Create value object
                                        let obj: any = {};
                                        obj[args.options.groupby] = x;
                                        obj["values"] = gbResult[x].length,
                                        gbResultReduced.push(obj);
                                    });
                                    vorpal.log(cTable.getTable(gbResultReduced));
                                }
                            }
                                
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
                    __this._executeDistantCommand("subscribe")
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
                    __this._executeDistantCommand("unsubscribe")
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
            if (this.globalParameters == null || reloadAll) {
                vorpal.log("Loading new parameters from server.");
                getTaskParametersPromise.push(this._getServerGlobalParameters());
            }
          
            //Wait GetParameters function if request needed  
            Promise.all(getTaskParametersPromise).catch(reject).then(() => { 
                //Parameters are retrieved: ready to ask values
                
                if (this.globalParameters == null || Object.keys(this.globalParameters).length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    //Parameters already retrieved
                    let vorpalPrompts: any = [];
                        
                    //Ask value for each parameters
                    for (let parameterKey in this.globalParameters) {
                        let parameter = this.globalParameters[parameterKey];
                        
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): " 
                        });
                    };
                    
                    vorpal.log("----------------------------");

                    vorpal.log("Configuring " + Object.keys(this.globalParameters).length + " parameter(s):");
                    
                    vorpalCommand.prompt(vorpalPrompts).then((answers: any) => {
                        vorpal.log("----------------------------");
                        
                        //Update parameters value
                        for (let answerKey in answers) {
                            if (this.globalParameters.hasOwnProperty(answerKey) && answers[answerKey] !== "") //Parameter exist and not empty parameter
                                this.globalParameters[answerKey].value = answers[answerKey];
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
    private _getServerGlobalParameters(){
        return new Promise((resolve, reject) => {
            this.server.cli["getGlobalParameters"]().then((parameters: GlobalParameterList) => {
                this.globalParameters = parameters;
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
    private _executeDistantCommand(commandName: string, ...parameters: any[]){
        return new Promise((resolve, reject) => {
            try {
                this.server.cli[commandName](...parameters).then((result: any) => {
                    resolve(result);
                });
            }
            catch(e){
                reject(e);
            }
        });
    }
    
    private _objectGroupByProperty(obj: any, prop: string){
        return obj.reduce(function(rv: any, x: any) {
            (rv[x[prop]] = rv[x[prop]] || []).push(x);
            return rv;
        }, {});
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
     * Add a custom command to the CLI
     * @param {string} commandWord
     * @param {string} commandDescription
     * @param {(args: any, endCommand: Function) => void} callback
     */
    public addCommand(commandWord: string, commandDescription: string, callback: (args: any, endCommand: Function) => void){
        vorpal
            .command(commandWord, commandDescription)
            .action((vorpalArgs: any, vorpalCallback: Function) => {
                callback(vorpalArgs, vorpalCallback);
            });
    }

    /**
     * Get the cli logger using set configuration
     * @returns {Logger}
     */
    public logger(): Logger {
        return logger.cli();
    }

}