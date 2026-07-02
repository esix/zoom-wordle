import express from 'express';
import { query } from 'express-validator';

import { handleError, sanitize } from '../helpers/routing.js';
import { getDeeplink, getToken } from '../helpers/zoom-api.js';

import session from '../session.js';

const router = express.Router();

const codeMin = 32;
const codeMax = 64;

// Validate the Authorization Code sent from Zoom
const validateQuery = [
    query('code')
        .isString()
        .withMessage('code must be a string')
        .isLength({ min: codeMin, max: codeMax })
        .withMessage(`code must be > ${codeMin} and < ${codeMax} chars`)
        .escape(),
    query('state').custom((value, { req }) => {
        const expectedState = req.session.state;

        if (!expectedState && value === undefined) return true;
        if (typeof value !== 'string')
            throw new Error('state must be a string');
        if (value !== expectedState) throw new Error('invalid state parameter');

        return true;
    }),
];

/*
 * Redirect URI - Zoom App Launch handler
 * The user is redirected to this route when they authorize your app
 */
router.get('/', session, validateQuery, async (req, res, next) => {
    req.session.state = null;

    try {
        // sanitize code and state query parameters
        sanitize(req);

        const code = req.query.code;
        const verifier = req.session.verifier;

        req.session.verifier = null;

        // get Access Token from Zoom
        const { access_token: accessToken } = await getToken(code, verifier);

        // fetch deeplink from Zoom API
        const deeplink = await getDeeplink(accessToken);

        // redirect the user to the Zoom Client
        res.redirect(deeplink);
    } catch (e) {
        next(handleError(e));
    }
});

export default router;
