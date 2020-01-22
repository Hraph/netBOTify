export enum TunnelStatus {
    Closed = 0,
    Connected
}

export enum TunnelProvider {
    Ngrok = "ngrok"
}

export interface Tunnel {
    localPort: number,
    status: TunnelStatus,
    provider: TunnelProvider
}

export interface WorkerTunnel {
    type: TunnelProvider,
    setConfig: (config: {}) => void,
    connect: (localPort: number, isTcp: boolean, onConnected: Function, onClosed: Function) => Promise<any>,
    disconnect: (localPort: number) => Promise<any>,
    disconnectAll: () => Promise<any>
}
