import { createServer } from 'http';
import { Server } from 'socket.io';
import debug from 'debug';
import { appName } from '../config.js';
import {
    getWordleState,
    normalizeRoomId,
    resetWordleGame,
    submitWordleGuess,
} from './wordle.js';

const dbg = debug(`${appName}:http`);

function onConnection(io) {
    return (socket) => {
        let room;

        function useRoom(meetingUUID) {
            const nextRoom = normalizeRoomId(meetingUUID);

            if (room && room !== nextRoom) socket.leave(room);

            room = nextRoom;
            socket.join(room);

            return room;
        }

        function joinRoom(meetingUUID) {
            const activeRoom = useRoom(meetingUUID);

            socket.emit('wordle:state', getWordleState(activeRoom));

            return activeRoom;
        }

        socket.on('wordle:join', ({ meetingUUID } = {}) => {
            joinRoom(meetingUUID);
        });

        socket.on('wordle:guess', ({ meetingUUID, player, word } = {}) => {
            const activeRoom = useRoom(meetingUUID || room);
            const result = submitWordleGuess({
                player,
                room: activeRoom,
                word,
            });

            if (result.error) {
                socket.emit('wordle:error', { message: result.error });
                return;
            }

            io.to(activeRoom).emit('wordle:state', result.state);
        });

        socket.on('wordle:reset', ({ meetingUUID } = {}) => {
            const activeRoom = useRoom(meetingUUID || room);
            const state = resetWordleGame(activeRoom);

            io.to(activeRoom).emit('wordle:state', state);
        });
    };
}

/**
 * Initialize the socket.io websocket handler
 * @param {Server} server HTTP Server
 */
function startWS(server, app) {
    const io = new Server(server, {
        transports: ['websocket'],
        maxHttpBufferSize: 1e8,
        pingTimeout: 60000,
    });

    app.set('io', io);

    io.on('connection', onConnection(io));
}

/**
 * Start the HTTP server
 * @param app - Express app to attach to
 * @param {String|number} port - local TCP port to serve from
 */
export async function start(app, port) {
    // Create HTTP server
    const server = createServer(app);
    startWS(server, app);

    // let the user know when we're serving
    server.on('listening', () => {
        const addr = server.address();
        const bind =
            typeof addr === 'string'
                ? `pipe ${addr}`
                : `http://localhost:${addr.port}`;
        dbg(`Listening on ${bind}`);
    });

    server.on('error', async (error) => {
        if (error?.syscall !== 'listen') throw error;

        const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

        // handle specific listen errors with friendly messages
        switch (error?.code) {
            case 'EACCES':
                throw new Error(`${bind} requires elevated privileges`);
            case 'EADDRINUSE':
                throw new Error(`${bind} is already in use`);
            default:
                throw error;
        }
    });

    // Listen on provided port, on all network interfaces
    return server.listen(port);
}
