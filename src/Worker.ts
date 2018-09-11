import {Client} from "./Client";
import {TaskStatus} from "./ClientIdentifier";
import {logger} from "./logger";
import {TaskParameter, TaskParameterList} from "./TaskParameter";

const EventEmitter = require("events");

/** @ignore */
declare var require: any;

export class Worker extends Client {
    private taskEvent: any;
    constructor(config: any = {}){
        super(config); //Create client

        this.taskEvent = new EventEmitter();

        this.client.ready((serverProxy: any) => { //Triggered ONCE when first time authenticated
            logger.worker().info('Connected to server');
        });

        /**
         * Client internal events handling
         */
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

        this._internalActions(this);
    }

    /**
     * Define all internal RPC methods callable for the worker
     * @param {Worker} __this
     * @private
     */
    private _internalActions(__this: Worker){
        /**
         * Action on task launch from the server
         * @param {TaskParameterList} parameters
         */
        this.client.exports.launchTask = function(parameters: TaskParameterList) {
            //this.serverProxy is injected by eureca
            
            __this.taskEvent.emit("launchTask", parameters, __this.server);
            __this.server.task.taskLaunched().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Running;
        };

        /**
         * Action on task stop from the server
         */
        this.client.exports.stopTask = function() {
            //this.serverProxy is injected by eureca

            __this.taskEvent.emit("stopTask", __this.server);
            __this.server.task.taskStopped().catch((e: any) => {
                logger.worker().error("Unable to execute command ", e);
            });
            __this.identifier.taskStatus = TaskStatus.Idle;
        };

        /**
         * Action on status request from the server
         */
        this.client.exports.statusTask = function() {
            //this.serverProxy is injected by eureca
            //TODO: implement
            __this.taskEvent.emit("statusTask", __this.server);
            
        };
    }

    /**
     * Add handler on task launch request event
     * @param {(parameters: TaskParameterList, server: any) => void} callback
     */
    public onLaunchTask(callback: (parameters: TaskParameterList, server: any) => void){
        this.taskEvent.on("launchTask", callback);
    }

    /**
     * Add handler on task stop request event
     * @param {(server: any) => void} callback
     */
    public onStopTask(callback: (server: any) => void){
        this.taskEvent.on("stopTask", callback);
    }

    /**
     * Add handler on task end request event
     * @param {(server: any) => void} callback
     */
    public onStatusTask(callback: (server: any) => void){
        this.taskEvent.on("statusTask", callback);
    }

    /**
     * Send the task result to the server
     * @param result
     */
    public sendTaskResult(result: any = null){
        if (this.server !== null)
            this.server.task.taskResult(result);
    }

    /**
     * Send a custom event to the server
     * @param {string} eventName
     * @param data
     */
    public sendTaskEvent(eventName: string, data: any = null){
        if (this.server !== null)
            this.server.task.taskEvent(eventName, data);
    }

    /**
     * Send task end status to the server
     * @param data
     */
    public sendTaskEnded(data: any = null){
        if (this.server !== null)
            this.server.task.taskEnded(data);
        this.identifier.taskStatus = TaskStatus.Idle;
    }
}