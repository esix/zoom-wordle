import express from 'express';
import axios from 'axios';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import debug from 'debug';
import helmet from 'helmet';
import logger from 'morgan';
import { dirname, join } from 'path';
import { fileURLToPath, URL } from 'url';

import { start } from './server/server.js';
import indexRoutes from './server/routes/index.js';
import authRoutes from './server/routes/auth.js';
import wordleRoutes from './server/routes/wordle.js';
import zoomWebhookRoutes from './server/routes/zoom-webhooks.js';

import { appName, port, publicBasePath, redirectUri } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/* App Config */
const app = express();
const dbg = debug(`${appName}:app`);

const redirectHost = new URL(redirectUri).host;

// views and assets
const staticDir = `${__dirname}/dist`;
const indexHtml = join(staticDir, 'index.html');

// HTTP
app.set('port', port);

// log Axios requests and responses
const logFunc = (r) => {
    if (process.env.NODE_ENV !== 'production') {
        let { method, status, url, baseURL, config } = r;

        const endp = url || config?.url;
        const base = baseURL || config?.baseURL;
        let str = new URL(endp, base).href;

        if (method) str = `${method.toUpperCase()} ${str}`;
        if (status) str = `${status} ${str}`;

        debug(`${appName}:axios`)(str);
    }

    return r;
};

axios.interceptors.request.use(logFunc);
axios.interceptors.response.use(logFunc);

/*  Middleware */
const headers = {
    frameguard: {
        action: 'sameorigin',
    },
    hsts: {
        maxAge: 31536000,
    },
    referrerPolicy: 'same-origin',
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            'default-src': 'self',
            styleSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://appssdk.zoom.us/sdk.min.js'],
            imgSrc: ["'self'", `https://${redirectHost}`],
            'connect-src': ["'self'", `wss://${redirectHost}`],
            'base-uri': 'self',
            'form-action': 'self',
        },
    },
};

app.use(helmet(headers));

app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf.toString('utf8');
        },
    })
);
app.use(compression());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(logger('dev', { stream: { write: (msg) => dbg(msg) } }));

// serve our app folder
app.use(express.static(staticDir));
if (publicBasePath) app.use(publicBasePath, express.static(staticDir));

/* Routing */
app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/api/wordle', wordleRoutes);
app.use('/webhooks/zoom', zoomWebhookRoutes);

if (publicBasePath) {
    app.use(publicBasePath, indexRoutes);
    app.use(`${publicBasePath}/auth`, authRoutes);
    app.use(`${publicBasePath}/api/wordle`, wordleRoutes);
    app.use(`${publicBasePath}/webhooks/zoom`, zoomWebhookRoutes);
    app.get(`${publicBasePath}/*`, (req, res) => res.sendFile(indexHtml));
}

app.get('*', (req, res) => res.sendFile(indexHtml));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const title = `Error ${status}`;

    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if (res.locals.error) dbg(`${title} %s`, err.stack);

    // render the error page
    res.status(status);
    res.type('text').send(`${title}: ${res.locals.message}`);
});

// start serving
start(app, port).catch(async (e) => {
    console.error(e);
    process.exit(1);
});

export default app;
