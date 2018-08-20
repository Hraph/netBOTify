import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";
import { logger } from "./logger";
import { TaskParameter } from "./TaskParameter";

const EurecaServer = require("eureca.io").Server;
const express = require('express')
    , app = express()
    , webServer = require('http').createServer(app);

/** @ignore */
declare var require: any;


export class Server {
    public clients: ClientIdentifier[] = [];
    private config: any = {};
    private server: any;
    private taskParameters: TaskParameter[];

    constructor(config: any = {}){
        this.config = config;
        this.taskParameters = [];
        let __this = this; //Keep context

        this.server = new EurecaServer({
            authenticate: function(identifier: ClientIdentifier, next: Function){
                try {
                    identifier.clientId = this.user.clientId; //Save socket clientId
                    identifier.ip = this.connection.remoteAddress.ip;//Save client ip
                }
                catch (e){
                    logger.server().error("Unable to get client info ", e);
                }

                __this.clients.push(identifier);
                next();
            },
            prefix: "nbfy",
            allow: ["launchTask", "stopTask", "statusTask"]
        });
        this.server.attach(webServer);

        this.server.on("unhandledMessage", function (msg: any) {
            logger.server().debug('Received message: ', msg);
        });

        this.server.onConnect(function(connection: any) {
           logger.server().debug('Client %s connected', connection.id);
           let client = connection.clientProxy;
        });

        this.server.onDisconnect(function (connection: any) {
            __this.clients = __this.clients.filter(client => client.clientId !== connection.id); //Remove client from clients
            logger.server().info('Client %s disconnected', connection.id);
        });

        this.server.onError(function (e: any) {
            logger.server().error('an error occured', e);
        });

        this._internalActions(this);
    }
    
    private _internalActions(__this: Server){
        this.server.exports.ping = function() {
            __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                client.latestReceivedPingTimestamp = Date.now();
            });
            return 1;
        };

        this.server.exports.task = {
            taskLaunched: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Running;
                });
            },
            taskStopped: function () {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Idle;
                });
            },
            taskLog: function (log: any) {

            },
            result: function(result: any) {
                console.log("result");
            }
        };

        this.server.exports.cli = {
            ping: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                   client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
            getWorkers: function() {
                return __this.clients.filter(client => client.clientType == ClientType.Worker);
            },
            getCLIs: function() {
                return __this.clients.filter(client => client.clientType == ClientType.RemoteCLI);
            },
            getParameters: function() {
                return __this.taskParameters;
            },
            launchTask: function (parameters: TaskParameter[] = []) {
                //Treat input parameters
                if (parameters.length !== 0) {
                    //Add value to local tasks
                    __this.taskParameters.forEach((parameter: TaskParameter) => {
                        let foundParameter = parameters.find((item: TaskParameter) => { // Match local parameter with argument parameter
                            return item.key == parameter.key
                        });
    
                        if (typeof foundParameter !== "undefined") // Change value of local parameter
                            parameter.value = foundParameter.value;
                    });
                }
                

                let count = 0;
                __this.clients.filter(client => client.clientType == ClientType.Worker).forEach(client => { // Get Workers clients ONLY
                    __this.server.getClient(client.clientId).launchTask(__this.taskParameters).catch((e: any) => {
                        logger.server().error("Unable to launch task ", e);
                    }).then(() => {
                        ++count;
                    });
                    
                });
                return count + " task(s) launched successfully";
            },
            stopTask: function () {
                let count = 0;
                __this.clients.filter(client => client.clientType == ClientType.Worker).forEach(client => { // Get Workers clients ONLY
                    __this.server.getClient(client.clientId).stopTask().catch((e: any) => {
                        logger.server().error("Unable to stop task ", e);
                    }).then(() => {
                        ++count;
                    });
                });
                return count + " task(s) stopped successfully";
            }
        }
    }

    /**
     * Launch server
     */
    public connect(): void{
        if (!this.config.port)
            this.config.port = 8000;
        webServer.listen(this.config.port);
    }
    
    public addTaskParameter(parameter: TaskParameter){
        this.taskParameters.push(parameter);
    }

    public addServerAction(name: string, callback: Function){
        this.server.exports[name] = callback;
    }

    public addWorkerTask(name: string){
        this.server.settings.allow.push(name);
    }
}
