#! /usr/bin/env node

//print the version of the application if command line arguments are passed
if (process.argv[2] && (process.argv[2].toLowerCase() === '-v' || process.argv[2] === '--version')) {
    console.log('Slidex v 1.0.7');
    process.exit(0);
} else if (process.argv[2]) {
    console.log('(✖_✖) Nothing I can do about that.');
    process.exit(0);
}

const express = require('express');
const keySender = require('node-key-sender');
const ip = require('ip');
const qrcode = require('qrcode-terminal');
const prompt = require('prompt');
const path = require('path');
const exec = require('child_process').exec;


const app = express(); //initialize an express server
const server = require('http').Server(app); // init an http server for socket.io
const io = require('socket.io')(server);

//only these keys will be activated by node-key-sender
const keys = ['left', 'right', 'up', 'down', 'space'];

//to serve static files for client
app.use(express.static(path.join(__dirname, 'public')));

//serve the html page with buttons
app.get('/', (req, res) => {
    res.sendFile('public/index.html', {
        root: __dirname
    });
});

//Monkey patching the node-key-sender library to fix jar path issues
keySender.execute = function(arrParams) {
    return new Promise(function(resolve, reject) {
        //path where the jar file resides
        const jarPath = path.join(__dirname,'node_modules', 'node-key-sender', 'jar', 'key-sender.jar');
        //generate command to execute the jar file
        //original command with path in quotes replace with path without enclosed in quotes
        const command = 'java -jar ' + jarPath + ' ' + arrParams.join(' ') + keySender.getCommandLineOptions();

        return exec(command, {}, function(error, stdout, stderr) {
            if (error == null) {
                resolve(stdout, stderr);
            } else {
                reject(error, stdout, stderr);
            }
        });
    });
}


//on new connection to socket.io
io.on('connection', function (socket) {
    socket.emit('status', 200); //send initial status code
    //get button click event and fire robot keyTap
    socket.on('key', async function (data) {
        console.log(data);
        if (data && keys.includes(data)) {
            try {
                await keySender.sendKey(data);
            } catch (error) {
                console.log(error);
            };

        }
    });
});

//init schema for user input
const schema = {
    properties: {
        portNumber: {
            description: 'Type a port number - Press Enter to start with -> ',
            default: '8080',
            conform: function (value) {
                if (/^[0-9]+$/.test(value)) {
                    //check whether the requested port is in protected range.
                    if (value >= 1024 && value <= 65535)
                        return true;
                    else {
                        schema.properties.portNumber.message = 'Port Number should be within (1024 - 65535) Due to root privilege requirement '
                        return false;
                    }
                } else {
                    schema.properties.portNumber.message = 'Port number should be only numbers'
                    return false;
                }
            }
        }
    }
};

//prompt for port to run the server
prompt.start();
prompt.get(schema, function (err, result) {
    //if result is undefined, ie. user tried to key combo to exit or some BS. exit the app
    if(!result) {
        process.exit(0);
    }
    //use default port, if input is invalid
    const port = result ? result.portNumber : 8080;
    server.listen(port, '0.0.0.0', function (err) {
        if (!err) {
            //if no error display the local ip
            console.log("\n\nLocal: http://127.0.0.1:" + port);
            //get the network ip and display it
            let network_address = "http://" + ip.address() + ":" + port;
            console.log("Network: " + network_address + "\n\n");
            //generate and display the qr code for network ip on terminal
            qrcode.generate(network_address);
        } else {
            console.log("Unable to run the server, is your port:"+ port +" already used?");
            this.close();
        }
    })
});