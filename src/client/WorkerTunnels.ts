import {TunnelProvider, WorkerTunnel} from "../models/WorkerTunnel";
import {logger} from "..";


export class WorkerTunnelNgrok implements WorkerTunnel {
    private ngrok: any = null;
    private config = {
        region: "eu"
    };

    public type = TunnelProvider.Ngrok;

    constructor(config: {} = {}) {
        this.setConfig(config);

        import("ngrok").then(ngrok => {
            this.ngrok = ngrok;

            if (typeof ngrok.connect == "undefined") { // Check loaded dependency
                logger.worker().fatal("Dependency ngrok is not installed!");
            }
        }).catch(() => {
            logger.worker().fatal("Dependency ngrok is not installed!");
        });
    }

    setConfig(config: {}) {
        console.log(this.config);
        Object.assign(this.config, config);
        console.log(this.config);
    };

    async connect (localPort: number, isTcp: boolean, onConnected: Function, onClosed: Function) {
        if (this.ngrok) {
        }
    }
    async disconnect (localPort: number) {

    }
    async disconnectAll() {

    }


}