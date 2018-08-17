import {Client} from "./Client";
import {TaskStatus} from "./ClientIdentifier";
import { logger } from "./logger";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;

export class Worker extends Client {
    private taskEvent: any;
    constructor(config: any = {}){
        super(config); //Create client

        let __this = this; //Keep context

        this.taskEvent = new EventEmitter();

        this.client.ready((serverProxy: any) => { //Triggered ONCE when first time authenticated
            logger.worker().info('Connected to server');
        });
        
        this.client.onConnect((client: any) => {
            if (this.client.isReady()) //Client reconnected
                logger.worker().info('Reconnected to server');
        });

        this.client.onUnhandledMessage(function (data: any) {
            logger.worker().debug('Received message: ', data);
        });

        this.client.onError(function (e: any) {
            if (e.type === "TransportError") {
                logger.worker().error("Unable to connect to server: code", e.description);
            }
            else {
                logger.worker().error('Unknown error ', e);
            }
        });

        this.client.onConnectionLost(function () {
            logger.worker().warn('Connection lost ... will try to reconnect');
        });

        this.client.onConnectionRetry(function (socket: any) {
            logger.worker().warn('retrying ...');

        });

        this.client.onDisconnect(function (socket: any) {
            logger.worker().info('Client disconnected ', socket.id);
        });

        this._internalActions();

        this.client.exports.launchTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("launchTask", __this.server);
            __this.server.task.taskLaunched().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Running;
        }

        this.client.exports.stopTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Idle;
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