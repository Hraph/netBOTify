import {ClientIdentifier} from "../models/ClientIdentifier";

export interface ClientConfig {
    uri?: string,
    autoConnect?: boolean,
    identifier?: ClientIdentifier,
    logger?: string
}