import {Client} from "./Client";
import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";
import {logger} from "./logger";
import {TaskParameter, TaskParameterList} from "./TaskParameter";

const EventEmitter = require("events"),
      vorpal = require('vorpal')(),
      cTable = require('console.table');

/** @ignore */
declare var require: any;


export class RemoteCLI extends Client {
    private taskEvent: any;
    private taskParameters: any = null;
    constructor(config: any = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientType.RemoteCLI;

        //##################### CLIENT EVENTS #####################
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
        
        //##################### CLI METHODS REGISTERING #####################
        this.client.exports.CLIOnEvent = function(eventName: string, data: any = null, clientId: string) {
            logger.cli().info("EVENT %s (%s):", eventName, clientId.substr(0,5), data); //Print the evnet with a shorten client id
        }
        
        //##################### VORPAL COMMANDS #####################
        //Define config delimiter
        if (!this.config.delimiter)
            this.config.delimiter = "netBOTify";

        //Vorpal config
        vorpal
            .delimiter(this.config.delimiter + '$');
            
        //Ping
        vorpal
            .command('ping', 'Ping the server.')
            .action((args: any, callback: Function) => {
                __this._executeDistantCommand("ping").then((result: any) => {
                    vorpal.log(result);
                    callback();
                });
            });
            
        //Launch
        vorpal
            .command('launch', 'Launch the task on workers.')
            .option('-f, --force', "Force sending start even if it's already launched")
            .action(function(args: any, callback: Function) {
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
                    __this._executeDistantCommand("launchTask", __this.taskParameters, args.options.force)  //Execute task with parameters
                        .catch(__this._serverInvalidCommandError)
                        .then((result: any) => {
                            vorpal.log("%d worker's task launched of %d worker%s", result.success, result.total, (result.total >= 2) ? "s" : "");
                            callback();
                        });
                });
                
            });
            
        //Parameters
        vorpal
            .command('parameters', 'Manage task parameters.')
            .option("-r, --reload", "Erase and reload the current parameters from the server.")
            .option("-s, --save", "Save parameters value on the server now.")
            .action(function(args: any, callback: Function) {
                // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                __this._setupTaskParameters(this, args.options.reload).then(() => {
                    if (args.options.save) {
                        __this._executeDistantCommand("saveParameters", __this.taskParameters)
                            .catch(__this._serverInvalidCommandError)
                            .then((result: any) => {
                                vorpal.log("Parameters saved on the server.");
                                callback();
                            });
                    }
                    else
                        callback();
                });
            });
            
        //Stop
        vorpal
            .command('stop', 'Stop the task on workers.')
            .option('-f, --force', "Force sending stop even if it's already stopped")
            .action((args: any, callback: Function) => {
                __this._executeDistantCommand("stopTask", args.options.force)
                    .catch(__this._serverInvalidCommandError)
                    .then((result: any) => {
                        vorpal.log("%d worker's task stopped of %d worker%s", result.success, result.total, (result.total >= 2) ? "s" : "");
                        callback();
                    });
            });
            
        //Workers
        vorpal
            .command('workers', 'Get server connected workers')
            .action((args: any, callback: Function) => {
                console.log(args);
                __this._executeDistantCommand("getWorkers")
                    .catch(__this._serverInvalidCommandError)
                    .then((result: any) => {
                        vorpal.log(result.length + " workers");
                        vorpal.log(cTable.getTable(result));
                        callback();
                    });
            });
        
        //CLIs
        vorpal
            .command('clis', 'Get server connected CLIs')
            .action((args: any, callback: Function) => {
                __this._executeDistantCommand("getCLIs")
                    .catch(__this._serverInvalidCommandError)
                    .then((result: any) => {
                        vorpal.log(result.length + " CLIs");
                        vorpal.log(cTable.getTable(result));
                        callback();
                    });
            });
            
        
        //Subscribe
        vorpal
            .command('subscribe', 'Subscribe to server worker events')
            .action((args: any, callback: Function) => {
                __this._executeDistantCommand("subscribe")
                    .catch(__this._serverInvalidCommandError)
                    .then((result: any) => {
                        vorpal.log("Subscribed to server events");
                        callback();
                    });
            });
            
        //Unsubscribe
        vorpal
            .command('unsubscribe', 'Unsubscribe to server worker events')
            .action((args: any, callback: Function) => {
                __this._executeDistantCommand("unsubscribe")
                    .catch(__this._serverInvalidCommandError)
                    .then((result: any) => {
                        vorpal.log("Unsubscribed to server events");
                        callback();
                    });
            });

    }
    
    public addCommand(commandWord: string, commandDescription: string, callback: (args: any, callback: Function) => void){
        vorpal
            .command(commandWord, commandDescription)
            .action((vorpalArgs: any, vorpalCallback: Function) => {
                callback(vorpalArgs, vorpalCallback);   
            });
    }
    
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
    
    private _getServerTaskParameters(){
        return new Promise((resolve, reject) => {
            this.server.cli["getParameters"]().then((parameters: TaskParameterList) => {
                this.taskParameters = parameters;
                resolve();
            }).catch(reject);
        })
    }

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

    private _serverInvalidCommandError(e: any){
        logger.cli().error("Error in command ", e);
    }

}