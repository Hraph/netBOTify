import RemoteCLI from '../src/RemoteCLI';
import ClientIdentifier, {ClientType} from '../src/ClientIdentifier';


let identifier = new ClientIdentifier("RemoteCLI", "1");
identifier.clientType = ClientType.RemoteCLI;

let cli = new RemoteCLI({
    uri: "http://localhost:8000/",
    identifier: identifier
});
