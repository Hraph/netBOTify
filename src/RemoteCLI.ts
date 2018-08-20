import {Client} from "./Client";
import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";
import { logger } from "./logger";
import { TaskParameter } from "./TaskParameter";

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

        this.client.ready((serverProxy: any) => {
            logger.cli().info("Connected to server");

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
                __this._executePrintDistantCommand("ping").then(() => {
                    callback();
                });
            });
            
        //Launch
        vorpal
            .command('launch', 'Launch the task on workers.')
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
                    __this._executePrintDistantCommand("launchTask", __this.taskParameters).then(() => { //Execute task with parameters
                        callback();
                    });
                })
            });
            
        //Parameters
        vorpal
            .command('parameters', 'Manage task parameters.')
            .option("-r, --reload", "Erase and reload the current server task parameters.")
            .action(function(args: any, callback: Function) {
                // @ts-ignore: TS2683 'this' implicitly has type 'any' because it does not have a type annotation.
                __this._setupTaskParameters(this, args.options.reload).then(() => {
                    callback();
                });
            });
            
        //Stop
        vorpal
            .command('stop', 'Stop the task on workers.')
            .action((args: any, callback: Function) => {
                __this._executePrintDistantCommand("stopTask").then(() => {
                    callback();
                });
            });
            
        //Workers
        vorpal
            .command('workers', 'Get server connected workers')
            .action((args: any, callback: Function) => {
                __this._executeTableDistantCommand("getWorkers").then(() => {
                    callback();
                });
            });
        
        //CLIs
        vorpal
            .command('clis', 'Get server connected CLIs')
            .action((args: any, callback: Function) => {
                __this._executeTableDistantCommand("getCLIs").then(() => {
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
                
                if (this.taskParameters == null || this.taskParameters.length === 0) {
                    vorpal.log("No parameters to manage.");
                    vorpal.log("----------------------------");
                    resolve();
                }
                else {
                    //Parameters already retrieved
                    let vorpalPrompts: any = [];
                        
                    //Ask value for each parameters
                    this.taskParameters.forEach((parameter: TaskParameter) => {
                        vorpalPrompts.push({
                            type: "input",
                            name: parameter.key,
                            message: parameter.message + " (CURRENT: " + parameter.value + ", DEFAULT: " + parameter.defaultValue + "): " 
                        });
                    });
                    
                    vorpal.log("----------------------------");

                    vorpal.log("Configuring " + this.taskParameters.length + " parameter(s):");
                    
                    vorpalCommand.prompt(vorpalPrompts).then((answers: any) => {
                        vorpal.log("----------------------------");
                        
                        //Update parameters value
                        this.taskParameters.filter((parameter: TaskParameter) => {
                            return answers.hasOwnProperty(parameter.key);
                        }).forEach((parameter: TaskParameter) => {
                            if (answers[parameter.key] !== "") //Not empty value
                                parameter.value = answers[parameter.key];
                        });
                        
                        resolve();
                    });
                }
                
            }); 
        });
    }
    
    private _getServerTaskParameters(){
        return new Promise((resolve, reject) => {
            this.server.cli["getParameters"]().then((parameters: TaskParameter[]) => {
                this.taskParameters = parameters;
                resolve();
            }).catch(reject);
        })
    }

    private _executePrintDistantCommand(commandName: string, ...parameters: any[]){
        return new Promise((resolve, reject) => {
            try {
                this.server.cli[commandName](...parameters).then((result: any) => {
                    vorpal.log(result);
                    resolve(result);
                });
            }
            catch(e){
                reject(e);
            }
        });
    }

    private _executeTableDistantCommand(commandName: string, ...parameters: any[]){
        return new Promise((resolve, reject) => {
            try {
                this.server.cli[commandName](...parameters).then((result: any) => {
                    vorpal.log(result.length + " items");
                    vorpal.log(cTable.getTable(result));
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