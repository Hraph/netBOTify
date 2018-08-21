# netBOTify [WIP]

netBOTify is a real-time and scalable server that lets you execute remote tasks over network using sub-workers.
An unlimited number of clients (bots) can be connected anywhere from the internet (using HTTP requests).

The tasks are executed and stopped remotely using a remote Command Line Interface.
Dynamic parameters can be defined at launch time.

## Main features

- Multiple workers over different servers / IPs
- No configuration needed on workers (can easily be executed on cloud application platforms)
- Automatic reconnection

## Installation

```npm install netbotify```
## Usage
#### Server implementation
~~~~javascript
const Netbotify = require("netbotify");

// Create a server
let server = new Netbotify.Server({
    port: 8000 // Server port to listen to
});

//Add parameters fot the workers
server.addTaskParameter("parameterKey", "defaultValue"); // Value will be editable with "parameters" command in CLI

server.connect();
~~~~

#### Worker (BOT) implementation
~~~~javascript
const Netbotify = require("netbotify");

// Create a worker
let worker = new Netbotify.Worker({
    uri: "http://localhost:8000/", // Server uri to connect to
    autoConnect: false // Auto-connect to server (default: true)
});

// Add task content on launch
worker.onLaunchTask((parameters, server) => {
    //Parameters contains a list of parameters defined by the CLI when the task is launched
    console.log("Task is launched by the server");

});

// Add task content on stop
worker.onStopTask((server) => {
    console.log("Task is stopped by the server");

});

worker.connect(); // In case of autoConnect: false
~~~~

#### Remote CLI implementation
~~~~javascript
const Netbotify = require("netbotify");

//Create a CLI
let cli = new Netbotify.RemoteCLI({
    uri: "http://localhost:8000/", // Server uri to connect to
    delimiter: "myApp", // CLI shell prefix
    autoConnect: false // Auto-connect to server (default: true)
});

//Add a custom command
cli.addCommand("commandName", "Command description", (args, callback) => {
    //Do your stuff
    console.log("foo");
    
    callback(); //Mandatory command return callback
});

cli.connect(); // In case of autoConnect: false
~~~~

##### CLI Default commands
- `parameters`: get the list of connected workers on the server
    - Options:
        - `-r, --reload`: erase and reload the current parameters from the server
- `workers`: get the list of connected workers on the server
- `clis`: get the list of connected CLIs on the server
- `launch`: start all the tasks on the connected workers
    - Options:
        - `-f, --force`: force sending start even if it's already launched
- `stop`: stop all the tasks on the connected workers
    - Options:
        - `-f, --force`: force sending stop even if it's already stopped

## Referencies

netBOTify is based on RPC (Remote Procedure Call) principle and wraps the [eureca.io](https://www.npmjs.com/package/eureca.io) package.