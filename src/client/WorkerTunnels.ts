import {TunnelProvider, TunnelStatus, WorkerTunnel} from "../models/WorkerTunnel";
import {logger} from "..";


export class WorkerTunnelNgrok implements WorkerTunnel {
    private ngrok: any = null;
    private config = {
        region: "eu"
    };

    public type = TunnelProvider.Ngrok;

    constructor(config: {} = {}) {
        this.setConfig(config);

        try {
            let ngrok = require("ngrok"); // Synchronous load
            if (typeof ngrok.connect == "undefined") { // Check loaded dependency
                logger.worker().fatal("Dependency ngrok is not installed!");
            }
            else {
                this.ngrok = ngrok; // Save dependency
            }
        }
        catch (e) {
            logger.worker().fatal("Dependency ngrok is not installed!");
        }
    }

    setConfig(config: {}) {
        Object.assign(this.config, config);
    };

    async connect (localPort: number, isTcp: boolean, onStatusChanged: (status: TunnelStatus) => void) {
        if (this.ngrok) {
            let config = {
                proto: (isTcp) ? "tcp" : "http",
                addr: localPort,
                onStatusChange: (status: string) => {
                    if (status == "connected")
                        onStatusChanged(TunnelStatus.Connected);
                    else
                        onStatusChanged(TunnelStatus.Disconnected);
                },
                onLogEvent: (data: any) => {
                    logger.worker().trace(data);
                }
            };
            Object.assign(config, this.config); // Merge config

            return this.ngrok.connect(config);
        }
    }
    async disconnect (url: string = "") {
        if (this.ngrok)
            return this.ngrok.disconnect(url);
    }
    async disconnectAll() {
        return this.disconnect();
    }


}