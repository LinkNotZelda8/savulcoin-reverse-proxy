const io = require('socket.io-client');
const superagent = require('superagent');

const argv = require('yargs')
    .usage('Usage: $0 [options]')
    .alias('addressId', 'Address ID')
    .alias('ws', 'Websocket url')
    .alias('savulcoinUrl', 'Savulcoin instance url')
    .argv;


const ADDRESS_ID = argv.addressId;
const WEBSOCKET_URL = argv.ws || 'ws://localhost:24568';
const SAVULCOIN_URL = argv.savulcoinUrl || 'http://localhost:3001';

const socket = io(WEBSOCKET_URL);

require('./console')('1', 6);

socket.on('connect', () => {
    socket.emit('clientInit', ADDRESS_ID);
    console.info('Connected to server!')
})

socket.on('request', (request) => {
    const URL = `${SAVULCOIN_URL}/${request.url}`;

    console.log(`Incoming request ${SAVULCOIN_URL}/${request.url}`);

    if (request.url.includes('miner/')) {
        console.warn('Cancelled miner request.');
        return;
    }

    let sa = null;
    if (request.method === 'POST') {
        sa = superagent.post(URL).send(request.body);
    } else {
        sa = superagent.get(URL);
    }

    sa.then((response) => {
            let data = {
                status: 404,
                body: ''
            };

            if (response !== undefined) {
                data = {
                    status: response.status || 404,
                    body: response.text || ''
                };
            }

            data = {...data, 
                id: request.id
            };

            socket.emit('requestResult', data);  
        })
        .catch((err) => {
            console.info(err);
            socket.emit('requestResult', {
                status: 404,
                body: 'Not found',
                id: request.id
            });  
        });
})

setInterval(function() {
    console.info("Keep alive.");
}, 1000 * 60 * 60);