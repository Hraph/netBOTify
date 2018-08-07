const log4js = require("log4js");

/** @ignore */
declare var require: any;

/**
 * Configuration
 */
log4js.configure({
    appenders: { out: { type: 'stdout', layout: { type: 'colored' } } },
    categories: { default: { appenders: [ 'out' ], level: 'debug' } }
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
log4js.trace = (message: string) => {
    return log4js.getLogger().trace(message);
};
log4js.debug = (message: string) => {
    return log4js.getLogger().debug(message);
};
log4js.info = (message: string) => {
    return log4js.getLogger().info(message);
};
log4js.warn = (message: string) => {
    return log4js.getLogger().warn(message);
};
log4js.error = (message: string) => {
    return log4js.getLogger().error(message);
};
log4js.fatal = (message: string) => {
    return log4js.getLogger().fatal(message);
};

export { log4js as logger }