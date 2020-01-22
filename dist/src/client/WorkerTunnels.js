"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const WorkerTunnel_1 = require("../models/WorkerTunnel");
const __1 = require("..");
class WorkerTunnelNgrok {
    constructor(config = {}) {
        this.ngrok = null;
        this.config = {
            region: "eu"
        };
        this.type = WorkerTunnel_1.TunnelProvider.Ngrok;
        this.setConfig(config);
        try {
            let ngrok = require("ngrok");
            if (typeof ngrok.connect == "undefined") {
                __1.logger.worker().fatal("Dependency ngrok is not installed!");
            }
            else {
                this.ngrok = ngrok;
            }
        }
        catch (e) {
            __1.logger.worker().fatal("Dependency ngrok is not installed!");
        }
    }
    setConfig(config) {
        Object.assign(this.config, config);
    }
    ;
    connect(localPort, isTcp, onStatusChanged) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ngrok) {
                let config = {
                    proto: (isTcp) ? "tcp" : "http",
                    addr: localPort,
                    onStatusChange: (status) => {
                        if (status == "connected")
                            onStatusChanged(WorkerTunnel_1.TunnelStatus.Connected);
                        else
                            onStatusChanged(WorkerTunnel_1.TunnelStatus.Disconnected);
                    },
                    onLogEvent: (data) => {
                        __1.logger.worker().trace(data);
                    }
                };
                Object.assign(config, this.config);
                return this.ngrok.connect(config);
            }
        });
    }
    disconnect(url = "") {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.ngrok)
                return this.ngrok.disconnect(url);
        });
    }
    disconnectAll() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.disconnect();
        });
    }
    kill() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.ngrok.kill();
        });
    }
}
exports.WorkerTunnelNgrok = WorkerTunnelNgrok;
//# sourceMappingURL=WorkerTunnels.js.map