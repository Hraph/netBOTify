import {Client} from "./Client";
import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";

const EventEmitter = require("events"),
      vorpal = require('vorpal')(),
      cTable = require('console.table');

/** @ignore */
declare var require: any;


export class RemoteCLI extends Client {
    private taskEvent: any;
    constructor(config: any = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.taskEvent = new EventEmitter();
        this.identifier.clientType = ClientType.RemoteCLI;

        this.client.ready((serverProxy: any) => {
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

        this.client.onError(function (e: any) {
            console.log('error', e);
        });

        if (!this.config.delimiter)
            this.config.delimiter = "netBOTify";

        //Vorpal config
        vorpal
            .delimiter(this.config.delimiter + '$');
        vorpal
            .command('ping', 'Ping the server.')
            .action((args: any, callback: Function) => {
                this._executePrintDistantCommand("ping", callback);
            });
        vorpal
            .command('launch', 'Launch the tasks on workers.')
            .action((args: any, callback: Function) => {
                this._executePrintDistantCommand("launchTasks", callback);
            });
        vorpal
            .command('stop', 'Stop the tasks on workers.')
            .action((args: any, callback: Function) => {
                this._executePrintDistantCommand("stopTasks", callback);
            });
        vorpal
            .command('workers', 'Get server connected workers')
            .action((args: any, callback: Function) => {
                this._executeTableDistantCommand("getWorkers", callback);
            });
        vorpal
            .command('clis', 'Get server connected CLIs')
            .action((args: any, callback: Function) => {
                this._executeTableDistantCommand("getCLIs", callback);
            });

    }

    private _executePrintDistantCommand(commandName: string, callback: Function){
        try {
            this.server.cli[commandName]().then((result: any) => {
                console.log(result);
            });
        }
        catch(e){
            this._serverInvalidCommandError(e);
        }
        finally {
            callback();
        }
    }

    private _executeTableDistantCommand(commandName: string, callback: Function){
        try {
            this.server.cli[commandName]().then((result: any) => {
                console.log(result.length + " items");
                console.table(result);
            });
        }
        catch(e){
            this._serverInvalidCommandError(e);
        }
        finally {
            callback();
        }
    }

    private _serverInvalidCommandError(e: any){
        console.log("Error in command ", e);
    }

}