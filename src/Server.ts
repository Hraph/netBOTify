import {ClientIdentifier, ClientType, TaskStatus} from "./ClientIdentifier";
import {logger} from "./logger";
import {TaskParameter, TaskParameterList} from "./TaskParameter";

const EurecaServer = require("eureca.io").Server;
const express = require('express')
    , app = express()
    , webServer = require('http').createServer(app)
    , EventEmitter = require("events");
    
/** @ignore */
declare var require: any;


export class Server {
    public clients: ClientIdentifier[] = [];
    private config: any = {};
    private server: any;
    private taskParameters: TaskParameterList = {}; //Save the parameters for the next task launch
    private serverEvent: any;
    private subscribedCLISToEvents: string[] = []; //Save the list of subscribed CLI

    constructor(config: any = {}){
        this.config = config;
        let __this = this; //Keep context
        this.serverEvent = new EventEmitter();

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
            allow: ["launchTask", "stopTask", "statusTask", "CLIOnEvent"]
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
            taskStatus: function (log: any) {
                //TODO: implement
            },
            taskResult: function(result: any) {
                __this.serverEvent.emit("taskResult", result, this.clientProxy);
                __this._sendEventToSubscribedCLIs("taskResult", result, this.user.clientId); //Send task event to subscribed CLIS
            },
            taskEvent: function(eventName: string, data: any = null){
                __this.serverEvent.emit("taskEvent:" + eventName, data);  
            },
            taskEnded: function(data: any) {
                __this.serverEvent.emit("taskEnded", data, this.clientProxy); //TODO pass the client identifier
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                    client.taskStatus = TaskStatus.Idle;
                });
                __this._sendEventToSubscribedCLIs("taskEnded", data, this.user.clientId); //Send task event to subscribed CLIS
            }
        };

        this.server.exports.cli = {
            ping: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => {
                   client.latestReceivedPingTimestamp = Date.now();
                });
                return "pong";
            },
            subscribe: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => { //Get current client
                    if (__this.subscribedCLISToEvents.indexOf(client.token) === -1) //Check if cli token is not already in list
                        __this.subscribedCLISToEvents.push(client.token);
                });
            },
            unsubscribe: function() {
                __this.clients.filter(client => client.clientId == this.user.clientId).forEach(client => { //Get current client
                    let index = __this.subscribedCLISToEvents.indexOf(client.token); //Find existing token
                    if (index !== -1) {
                        __this.subscribedCLISToEvents.splice(index, 1); //Remove item
                    }
                });
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
            saveParameters: function(parameters: TaskParameterList = {}) {
                __this._saveTaskParameters(parameters); //Save parameters
            },
            launchTask: function (parameters: TaskParameterList = {}, forceLaunch: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                
                __this._saveTaskParameters(parameters); //Save parameters
                
                let total = 0;
                
                __this.clients.filter(client => client.clientType == ClientType.Worker).forEach(client => { // Get Workers clients ONLY
                    if (forceLaunch || client.taskStatus != TaskStatus.Running) { // Launch task only if task is not currently running
                        clientPromises.push(__this.server.getClient(client.clientId).launchTask(__this.taskParameters)); //Launch task
                    }
                    
                    ++total;
                });
                
                Promise.all(clientPromises).catch((e: any) => { //Wait all launches to finish
                    logger.server().error("Unable to launch task ", e);
                    //TODO Send error to CLI
                }).then((results: any) => {
                    context.return({
                        success: results.length,
                        total: total
                    });
                });
            },
            stopTask: function (forceStop: boolean = false) {
                let clientPromises: any[] = [];
                let context = this;
                context.async = true; //Define an asynchronous return
                
                let total = 0;
                
                __this.clients.filter(client => client.clientType == ClientType.Worker).forEach(client => { // Get Workers clients ONLY
                    if (forceStop || client.taskStatus != TaskStatus.Idle) { // Stop task only if task is not currently stopped
                        clientPromises.push(__this.server.getClient(client.clientId).stopTask()); //Stop task
                    }
                    
                    ++total;
                });
                
                Promise.all(clientPromises).catch((e: any) => { //Wait all stops to finish
                    logger.server().error("Unable to stop task ", e);
                    //TODO Send error to CLI
                }).then((results: any) => {
                    context.return({
                        success: results.length,
                        total: total
                    });
                });
            }
        }
    }
    
    private _sendEventToSubscribedCLIs(eventName: string, data: any = null, clientId: string){
        this.clients.filter(client => (client.clientType == ClientType.RemoteCLI && this.subscribedCLISToEvents.indexOf(client.token) !== -1)) //Get subscribed clients wich are CLIS
                    .forEach(client => { 
            this.server.getClient(client.clientId).CLIOnEvent(eventName, data, clientId); //Send event
        });
    }
    
    private _saveTaskParameters(parameters: TaskParameterList = {}){
        //Treat input parameters
        if (Object.keys(parameters).length !== 0) {
            for (let parameterKey in parameters) {
                let parameter = parameters[parameterKey];
                
                if (this.taskParameters.hasOwnProperty(parameter.key)) {
                    this.taskParameters[parameter.key] = parameter; //Update the local parameter
                }
            };
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
    
    
    public onTaskResult(callback: (result: any, client: any) => void){
        this.serverEvent.on("taskResult", callback);
    }
    
    public onTaskEvent(eventName: string, callback: (data: any, client: any) => void){
        this.serverEvent.on("taskEvent:" + eventName, callback);
    }
    
    public onTaskEnded(callback: (data: any, client: any) => void){
        this.serverEvent.on("taskEnded", callback);
    }
    
    public addTaskParameter(key: string, defaultValue: any, value: any = null){
        this.taskParameters[key] = (new TaskParameter(key, defaultValue, value));
    }

    public addServerAction(name: string, callback: Function){
        this.server.exports[name] = callback;
    }

    public addWorkerTask(name: string){
        this.server.settings.allow.push(name);
    }
}
