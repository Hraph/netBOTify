# netBOTify

netBOTify is a real-time and scalable server that lets you execute remote tasks over network using sub-workers.
An unlimited number of clients (bots) can be connected anywhere from the internet (using HTTP requests).

The tasks are executed and stopped remotely using a remote Command Line Interface.
Dynamic parameters can be defined at launch time.

## Main features

- Multiple workers over different servers / IPs
- No configuration needed on workers (can easily be executed on cloud application platforms)
- Global parameters sent to all workers
- Unique parameters (identity) for each workers
- Automatic reconnection

## Installation

```npm install netbotify```

## Usage

1. [Server usage](#server)
2. [Worker (bot) usage](#worker)
3. [Remote CLI usage](#cli)

---
### 1. Server implementation <a id="server"></a>

A server can easily be created with:
~~~~javascript
const Netbotify = require("netbotify");

// Create a server
let server = new Netbotify.Server({
    //Parameters
    port: 8000 // Server port to listen to
});
server.connect();
~~~~
#### OPTIONAL server parameters
- `port`: the server listening port (default 8000)
- `logDirectoryPath`: directory path to save workers events (start / stop / launch / errors / ...)
- `resultFilePath`: json file path to save all the results for all workers
- `intervalPrintStatus`: print server info status (workers connected, workers launched, CLIs connected) with interval in seconds (0 is disabled)
- `logger`: set the minimal printed mode of logs from `debug`, `info`, `error`

#### Server extra methods

- `.connect()`: launch the server on the specified port in parameters (default port is 8000)
- `.onTaskResult(callback)`: add an action when a result is given by a worker. Callback will receive 3 parameters: (result, clientIdentifier, workerProxy)
- `.onTaskEnded(callback)`: add an action when a task is ended by a worker. Callback will receive 3 parameters: (data, clientIdentifier, workerProxy)
- `.onTaskEvent(eventName, callback)`: add an action when a specific event is sent by a worker. Callback will receive 3 parameters: (data, clientIdentifier, workerProxy)

- `.addGlobalParameter(parameterKey, defaultValue)`: add a parameter that will be sent to all workers at task launch. To set a parameter value at runtime, use the command `parameters` on CLI and follow the instructions.
- `.getGlobalParameter(key)`: get a specific parameter object (of type GlobalParameter)
- `.addServerAction(name, callback)`: add a method to the server that will be callable by any clients (workers / cli) using server.{methodName}(anyParameters). Callback can have any desired parameters
- `.declareWorkerTask(name)`: declare an custom method on the worker that will be callable by the server.

- `.onWorkerGetIdentity(callback)`: add a callback called on worker launch to give a unique identity to the worker. Callback must return a Promise<WorkerIdentity> type.
- `.onWorkerReleaseIdentity(callback)`: add a callback called on worker stop / disconnect to release a previously borrowed identity from a worker. The old promise is given to the callback parameters. Callback must return a Promise type.
---
### 2. Worker (BOT) implementation <a id="worker"></a>

To create a worker doing a task simply do:
~~~~javascript
const Netbotify = require("netbotify");

//OPTIONAL: create an identity of the worker (group name and instance id)
let identifier = new Netbotify.ClientIdentifier("group1", "instance1");

// Create a worker
let worker = new Netbotify.Worker({
    uri: "http://localhost:8000/", // Server uri to connect to,
    identifier: identifier //Pass a custom identifier
});

// Add task content on launch
worker.onLaunchTask((identity, parameters, server) => {
    //Identity contains an unique identity given by onWorkerGetIdentity(callback) method on task launch
    
    //Parameters contains all global parameters defined by the CLI when the task is launched
    console.log("Parameter 'id': ", parameters.id.value); // Should have defaultValue "12345678"
    console.log("Task is launched by the server");
    
    //Do your stuff
});

// Add task content on stop
worker.onStopTask((server) => {
    console.log("Task is stopped by the server");
    
    //Stop your things
});
~~~~

#### OPTIONAL bot parameters
- `autoConnect`: if autoConnect is set to false, connect manually to the server with .connect()
- `identifier`: give a custom identifier to the worker
- `logger`: set the minimal printed mode of logs from `debug`, `info`, `error`

#### Bot extra methods
- `.connect()`: if autoConnect is set to false, connect manually to the server
- `.onLaunchTask(callback)`: add an action on launching the task by the server
- `.onStopTask(callback)`: add an action on stopping the task by the server
- `.sendTaskResult(result)`: send the task result the server (worker is still running)
- `.sendTaskError(error)`: send an error and set status "error"
- `.sendTaskEnd(data)`: send that the task has ended (with custom data) and set status "ended"
- `.sendTaskEvent(eventName, data)`: send a custom event to the server

---
### 3. Remote CLI implementation <a id="cli"></a>

The server is controllable by a remote shell that can be created with:
~~~~javascript
const Netbotify = require("netbotify");

//Create a CLI
let cli = new Netbotify.RemoteCLI({
    uri: "http://localhost:8000/", // Server uri to connect to
    delimiter: "myApp", // CLI shell prefix
});

//Add a custom command
cli.addCommand("commandName", "Command description", (args, callback) => {
    //Do your stuff
    console.log("foo");
    
    callback(); //Mandatory command return callback
});
~~~~

#### OPTIONAL CLI parameters
- `autoConnect`: if autoConnect is set to false, connect manually to the server with .connect()
- `delimiter`: set a custom prefix for the shell
- `autoSubscribe`: subscribe automatically the the server events (tasks results, task ends) when the server is connected
- `identifier`: give a custom identifier to the cli
- `logger`: set the minimal printed mode of logs from `debug`, `info`, `error`

#### CLI extra methods
- `.connect()`: if autoConnect is set to false, connect manually to the server
- `.addCommand(commandWord, commandDescription, callback)`: add an shell command to the CLI defined be the commandWord. Callback will receive 2 parameters: (args, endCommand): the arguments passed to the command and a callback to execute at the end of the command.

#### CLI Default commands
- `parameters`: set the values of global parameters. Values are kept locally on the CLI until --save is used.
    - Options:
        - `-r, --reload`: erase local and reload the current parameters from the server
        - `-s, --save`: save parameters value on the server 
- `subscribe`: subscribe to the server (implicitly worker) events (result, errors)
- `unsubscribe`: unsubscribe to the server (implicitly worker) events (result, errors)
- `workers [token]`: get the list of connected workers on the server
    - Options:
        - `[token]`: set a specific worker's token to get
- `clis [token]`: get the list of connected CLIs on the server
    - Options:
        - `[token]`: set a specific cli's token to get
- `launch [token]`: start all the tasks on the connected workers
    - Options:
        - `[token]`: set a specific worker's token to launch   
        - `-f, --force`: force sending start even if it's already launched
        - `-l, --limit <amount>`: restrict to a certain amount of workers
- `stop [token]`: stop all the tasks on the connected workers
    - Options:
        - `[token]`: set a specific worker's token to stop 
        - `-f, --force`: force sending stop even if it's already stopped
        - `-l, --limit <amount>`: restrict to a certain amount of workers

## Referencies

netBOTify is based on RPC (Remote Procedure Call) principle and wraps the [eureca.io](https://www.npmjs.com/package/eureca.io) package.