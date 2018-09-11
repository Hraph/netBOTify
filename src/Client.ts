import {ClientIdentifier} from "./ClientIdentifier";

const EurecaClient = require("eureca.io").Client;

/** @ignore */
declare var require: any;


export class Client {
    protected config: any = {};
    protected client: any;
    protected server: any = null;
    protected identifier: ClientIdentifier;
    private pingInterval: any;
    private pingTimeout: any;
    private pingIntervalSecond: number = 5;
    private pingTimeoutSecond: number = 2;

    protected constructor(config: any = {}){
        this.config = config;

        //Default identifier
        this.identifier = config.identifier ? config.identifier : new ClientIdentifier("defaultGroup", "defaultInstance");

        /**
         * Client initialization
         * @type {Eureca.Client}
         */
        this.client = new EurecaClient({
            uri: (this.config.uri) ? this.config.uri : "http://localhost:8000/",
            prefix: "nbfy",
            autoConnect: (this.config.autoConnect) ? this.config.autoConnect : true,
        });

        /**
         * Client internal events handling
         */
        this.client.ready((serverProxy: any) => { //Triggered when authenticated
            this.server = serverProxy;
            this.launchPing(serverProxy);
        });

        this.client.onConnect((client: any) => {
            if (this.client.isReady()) //Client was already connected but is now reconnecting : increment reconnect count
                ++this.identifier.reconnect;
            
            this.client.authenticate(this.identifier); //Authenticate when connect

            if (this.client.isReady()) //Client was already connected but is now reconnecting : now relaunch ping while it's authenticated
                this.launchPing(client._proxy);
        });

        this.client.onDisconnect((socket: any) => {
            this.stopPing();
        });
    }

    /**
     * Defines default Client config
     * @param config
     * @returns {{}}
     * @private
     */
    private _sanitizeConfig(config: any = {}): {}{
        return config;
    }

    /**
     * Launch ping interval
     * @param server
     */
    protected launchPing(server: any){
        this.pingInterval = setInterval(() => {
            //Timeout
            this.pingTimeout = setTimeout(() => {
                this.client.trigger("connectionLost");
                this.stopPing();
            }, this.pingTimeoutSecond * 1000);

            server.ping().then((result: any) => {
                clearTimeout(this.pingTimeout);
            });
        }, this.pingIntervalSecond * 1000);
    }

    /**
     * Stop ping to avoid flood if connection is lost
     */
    protected stopPing(){
        clearInterval(this.pingInterval);
    }
    
    /**
     * Manually connect to the server
     * @public
     */
    public connect(){
        this.client.connect();
    }

    /**
     * Add an item to config
     * @param {string} name
     * @param item
     * @returns {this}
     */
    public addConfigItem(name: string, item: any){
        this.config[name] = item;
        return this;
    }
}