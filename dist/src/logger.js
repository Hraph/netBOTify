"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log4js = require("log4js");
exports.logger = log4js;
let configuration = {
    appenders: { out: { type: 'stdout', layout: { type: 'colored' } } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
};
log4js.configure(configuration);
log4js.server = () => {
    return log4js.getLogger("[SERVER]");
};
log4js.setServerLevel = (level) => {
    configuration.categories["[SERVER]"] = { appenders: ['out'], level: level };
    log4js.configure(configuration);
};
log4js.worker = () => {
    return log4js.getLogger("[WORKER]");
};
log4js.setWorkerLevel = (level) => {
    configuration.categories["[WORKER]"] = { appenders: ['out'], level: level };
    log4js.configure(configuration);
};
log4js.cli = () => {
    return log4js.getLogger("[CLI]");
};
log4js.setCliLevel = (level) => {
    configuration.categories["[CLI]"] = { appenders: ['out'], level: level };
    log4js.configure(configuration);
};
log4js.trace = (message, ...args) => {
    return log4js.getLogger().trace(message, ...args);
};
log4js.debug = (message, ...args) => {
    return log4js.getLogger().debug(message, ...args);
};
log4js.info = (message, ...args) => {
    return log4js.getLogger().info(message, ...args);
};
log4js.warn = (message, ...args) => {
    return log4js.getLogger().warn(message, ...args);
};
log4js.error = (message, ...args) => {
    return log4js.getLogger().error(message, ...args);
};
log4js.fatal = (message, ...args) => {
    return log4js.getLogger().fatal(message, ...args);
};
//# sourceMappingURL=logger.js.map