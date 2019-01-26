export interface ServerConfig {
    port?: number,
    logDirectoryPath?: string,
    resultFilePath?: string,
    separateInstanceLogFiles?: boolean,
    intervalPrintStatus?: number,
    logger?: string
}