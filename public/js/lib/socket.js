import { io } from 'socket.io-client';

const basePath =
    document
        .querySelector('meta[name="app-base-path"]')
        ?.getAttribute('content') || '';

const socket = io(window.location.origin, {
    path: `${basePath}/socket.io`,
    transports: ['websocket', 'polling'],
});

socket.on('error', ({ message, code }) => {
    const e = new Error(message);
    e.code = code;
    console.error(e);
});

export default socket;
