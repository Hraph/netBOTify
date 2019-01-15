const log4js = require("log4js");

/** @ignore */
declare var require: any;

let configuration: any = {
    appenders: { out: { type: 'stdout', layout: { type: 'colored' } } },
    categories: { default: { appenders: [ 'out' ], level: 'debug' } }
}

/**
 * Initial Configuration
 */
log4js.configure(configuration);


/**
 * Custom logger layout for server
 * @returns {Logger}
 */
log4js.server = () => {
    return log4js.getLogger("[SERVER]");
};

/**
 * Set the minimum logger level for Server
 */
log4js.setServerLevel = (level: string) => {
    configuration.categories["[SERVER]"] = { appenders: [ 'out' ], level: level }; // Set config
    log4js.configure(configuration); // Apply config
}

/**
 * Custom logger layout for worker
 * @returns {Logger}
 */
log4js.worker = () => {
    return log4js.getLogger("[WORKER]");
};

/**
 * Set the minimum logger level for Worker
 */
log4js.setWorkerLevel = (level: string) => {
    configuration.categories["[WORKER]"] = { appenders: [ 'out' ], level: level }; // Set config
    log4js.configure(configuration); // Apply config
}

/**
 * Custom logger layout for CLI
 * @returns {Logger}
 */
log4js.cli = () => {
    return log4js.getLogger("[CLI]");
};

/**
 * Set the minimum logger level for CLI
 */
log4js.setCliLevel = (level: string) => {
    configuration.categories["[CLI]"] = { appenders: [ 'out' ], level: level }; // Set config
    log4js.configure(configuration); // Apply config
}

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