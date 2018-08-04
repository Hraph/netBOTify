import Client from "./Client";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;


export default class Worker extends Client {
    private taskEvent: any;
    constructor(config: any = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.taskEvent = new EventEmitter();

        this.client.ready((serverProxy: any) => { //Triggered when authenticated

        });

        this.client.onConnect((connection: any) => {
            //__this.identifier.clientId = connection.id;
            console.log('Incomming connection');
        });

        this.client.onMessage(function (data: any) {
            console.log('Received data', data);
        });

        this.client.onError(function (e: any) {
            console.log('error', e);
        });

        this.client.onConnectionLost(function () {
            console.log('connection lost ... will try to reconnect');
        });

        this.client.onConnectionRetry(function (socket: any) {
            console.log('retrying ...');

        });

        this.client.onDisconnect(function (socket: any) {
            console.log('Client disconnected ', socket.id);
        });

        this.client.on("reconnecting", () => {
            console.log("update");
        } );

        this._internalActions();


        this.client.exports.launchTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("launchTask", __this.server);
        }

        this.client.exports.stopTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("stopTask", __this.server);
        }
    }

    public onLaunchTask(callback: (server: any) => void){
        this.taskEvent.on("launchTask", callback);
    }

    public onStopTask(callback: (server: any) => void){
        this.taskEvent.on("stopTask", callback);
    }


    private _internalActions(){

    }
}