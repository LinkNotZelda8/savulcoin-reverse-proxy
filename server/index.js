const EventEmitter = require('events').EventEmitter;

const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');

const match = require('./match');

const port = 24568;

require('./console')('1', 6);


class Request {
    constructor(res, path, addressId, method, body, ipAddress) {
        this.res = res;
        this.path = path;
        this.addressId = addressId;
        this.method = method;
        this.body = body;
        this.ipAddress = ipAddress;
    }
}

var ALLOWED_PATHS = fs.readFileSync("./allowedPaths.txt", {encoding:'utf8', flag:'r'}).split("\n");
var eventEmitter = new EventEmitter();


io.on('connection', (socket) => {
    var ipAddress = socket.request.connection.remoteAddress;
    
    if (socket.handshake.headers.hasOwnProperty("x-forwarded-for")) {
        ipAddress = socket.handshake.headers["x-forwarded-for"].split(",")[0];
    }

    console.log('New connection from '+ipAddress);

    var addressId = undefined;
    var requestId = 0;

    var requests = new Map();

    function startEvents() { // Start listening to events
        eventEmitter.addListener(addressId, eventListener);
    }

    function eventListener(request) {
        let id = ++requestId;
        let data = {
            method: request.method,
            url: request.path,
            id: id
        };

        if (request.method === 'POST' || request.method === 'PUT') {
            data = { ...data,
                body: request.body
            };    
        }

        console.info(`${request.ipAddress} ${request.method} /${addressId}/${request.path}`);

        requests.set(id, request);
        socket.emit('request', data);
    }

    function clearEvents() {
        console.info(`Dispatching events for ${addressId}`);
        eventEmitter.removeListener(addressId, eventListener);
    }

    socket.on('clientInit', (id) => { // Init client
        if (id.length !== 64) {
            console.warn("Invalid id length.");
            socket.disconnect(true);
            return;
        }

        if (eventEmitter.listeners(id).length > 0) {
            console.warn("Same id already exists");
            socket.disconnect(true);
            return;
        }
        
        addressId = id;

        console.info(`${ipAddress} registered ${id}`);
        startEvents();
    });

    socket.on('requestResult', (data) => { // On get result
        requests.get(data.id).res.status(data.status).send(data.body);
    });

    socket.on('disconnect', (reason) => {
        requests.clear();
        clearEvents();
        
        console.info(`${ipAddress} disconnected.`);
    });
});

app.all('/:addressId([a-zA-Z0-9]{64})/:path(*)', (req, res) => {
    if (shouldAllowPath(req.params.path)) {
        eventEmitter.emit(req.params.addressId, new Request(res, req.params.path, req.params.addressId, req.method, req.body, req.ip));
    } else {
        res.status(404).send("Not found");
        console.info(`${req.ip} /${req.params.path} path not allowed.`)
    }
})

function shouldAllowPath(path) {
    for (var allowed of ALLOWED_PATHS) {
        if (match(path, allowed)) {
            return true;
        }
    }

    return false;
}

http.listen(port, () => {
    console.info(`Server running at http://*:${port}/`);
});
