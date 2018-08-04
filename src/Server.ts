import ClientIdentifier, {ClientType} from "./ClientIdentifier";

const EurecaServer = require("eureca.io").Server;
const express = require('express')
    , app = express()
    , webServer = require('http').createServer(app);

/** @ignore */
declare var require: any;


export default class Server {
    clients: ClientIdentifier[] = [];
    config: any = {};
    private server: any;
    private _internalActions(){
        this.server.exports.ping = function () {
            return 1;
        }

        this.server.exports.task = {
            result: (result: any) => {
                console.log("result");
            }
        }

        this.server.exports.cli = {
            ping: () => {
                return 1;
            }
        }
    }
    private _authenticate(identifier: ClientIdentifier, next: Function){
        this.clients.push(identifier);
        next();
    }

    constructor(config: any = {}){
        this.config = config;

        this.config.authenticate = this._authenticate;

        this.server = new EurecaServer({
            prefix: "nbfy",
            allow: ["launchTask", "stopTask", "statusTask"]
        });
        this.server.attach(webServer);

        this.server.onMessage(function (msg: any) {
            console.log('RECV', msg);
        });

        this.server.onConnect(function(connection: any) {
           console.log("connection", connection);
           let client = connection.clientProxy;
            setTimeout(() => {
                //client.launchTask();
            }, 3000);
        });


        this.server.onDisconnect(function (connection: any) {
            console.log('client %s disconnected', connection.id);
        });

        this.server.onError(function (e: any) {
            console.log('an error occured', e);
        });

        this._internalActions();
    }

    /**
     * Launch server
     */
    public connect(): void{
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
    }

    public addServerAction(name: string, callback: Function){
        this.server.exports[name] = callback;
    }

    public addWorkerTask(name: string){
        this.server.settings.allow.push(name);
    }
}
