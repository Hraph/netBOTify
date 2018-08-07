"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const log4js = require("log4js");
exports.logger = log4js;
/**
 * Configuration
 */
log4js.configure({
    appenders: { out: { type: 'stdout', layout: { type: 'colored' } } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});
/**
 * Custom logger layout for server
 * @returns {Logger}
 */
log4js.server = () => {
    return log4js.getLogger("[SERVER]");
};
/**
 * Custom logger layout for worker
 * @returns {Logger}
 */
log4js.worker = () => {
    return log4js.getLogger("[WORKER]");
};
/**
 * Custom logger layout for CLI
 * @returns {Logger}
 */
log4js.cli = () => {
    return log4js.getLogger("[CLI]");
};
/**
 * Default logger print functions for default layout
 */
log4js.trace = (message) => {
    return log4js.getLogger().trace(message);
};
log4js.debug = (message) => {
    return log4js.getLogger().debug(message);
};
log4js.info = (message) => {
    return log4js.getLogger().info(message);
};
log4js.warn = (message) => {
    return log4js.getLogger().warn(message);
};
log4js.error = (message) => {
    return log4js.getLogger().error(message);
};
log4js.fatal = (message) => {
    return log4js.getLogger().fatal(message);
};
//# sourceMappingURL=logger.js.map