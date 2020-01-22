export declare enum TunnelStatus {
    Stopped = "stopped",
    Disconnected = "disconnected",
    Connected = "connected"
}
export declare enum TunnelProvider {
    Ngrok = "ngrok"
}
export interface Tunnel {
    localPort: number;
    url: string;
    status: TunnelStatus;
    provider: TunnelProvider;
}
export interface WorkerTunnel {
    type: TunnelProvider;
    setConfig: (config: {}) => void;
    connect: (localPort: number, isTcp: boolean, onStatusChanged: (status: TunnelStatus) => void) => Promise<any>;
    disconnect: (url: string) => Promise<any>;
    disconnectAll: () => Promise<any>;
    kill: () => Promise<any>;
}
