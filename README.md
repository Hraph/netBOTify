## netBOTify [WIP]

netBOTify is a real-time and scalable server that lets you execute remote tasks over network using sub-workers.
An unlimited number of clients (bots) can be connected anywhere from the internet jungle. 

The tasks are executed remotely using a remote Command Line Interface.

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

server.connect();

~~~~

#### Worker (BOT) implementation
~~~~javascript
const Netbotify = require("netbotify");

// Create a worker
let worker = new Netbotify.Worker({
    uri: "http://localhost:8000/" // Server uri to connect to
});

// Add task content on launch
worker.onLaunchTask((server: any) => {
    console.log("Task is launched by the server");

});

// Add task content on stop
worker.onStopTask((server: any) => {
    console.log("Task is stopped by the server");

});


~~~~

#### Remote CLI implementation
~~~~javascript
const Netbotify = require("netbotify");

//Create a CLI
let cli = new Netbotify.RemoteCLI({
    uri: "http://localhost:8000/", // Server uri to connect to
    delimiter: "myApp" // CLI shell prefix
});

~~~~

##### CLI Default commands
- `workers`: get the list of connected workers on the server
- `clis`: get the list of connected CLIs on the server
- `launch`: start all the tasks on the connected workers
- `stop`: stop all the tasks on the connected workers

## Referencies

netBOTify is based on RPC (Remote Procedure Call) principle and wraps the [eureca.io](https://www.npmjs.com/package/eureca.io) package.