import {Worker} from '../src/Worker';
import {ClientIdentifier} from '../src/ClientIdentifier';
import {TaskParameter, TaskParameterList} from "../src/TaskParameter";

let identifier = new ClientIdentifier("group1", "1");

let worker = new Worker({
    uri: "http://localhost:8000/",
    identifier: identifier
});

worker.onLaunchTask((parameters: TaskParameterList, server: any) => {
    console.log("launch", parameters);
    worker.sendTaskEvent("hello", ["h", "e", "l", "l", "o"]);
});

worker.onStopTask((server: any) => {
    console.log("stop");
    worker.sendTaskResult("Ok");
    worker.sendTaskEnded();
});