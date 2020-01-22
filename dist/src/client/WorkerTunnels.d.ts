import { TunnelProvider, TunnelStatus, WorkerTunnel } from "../models/WorkerTunnel";
export declare class WorkerTunnelNgrok implements WorkerTunnel {
    private ngrok;
    private config;
    type: TunnelProvider;
    constructor(config?: {});
    setConfig(config: {}): void;
    connect(localPort: number, isTcp: boolean, onStatusChanged: (status: TunnelStatus) => void): Promise<any>;
    disconnect(url?: string): Promise<any>;
    disconnectAll(): Promise<any>;
    kill(): Promise<any>;
}
