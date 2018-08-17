import {Worker} from '../src/Worker';
import {ClientIdentifier} from '../src/ClientIdentifier';
import { TaskParameter } from "../src/TaskParameter";

let identifier = new ClientIdentifier("group1", "1");

let worker = new Worker({
    uri: "http://localhost:8000/",
    identifier: identifier
});

worker.onLaunchTask((parameters: TaskParameter[], server: any) => {
    console.log("launch", parameters);

});