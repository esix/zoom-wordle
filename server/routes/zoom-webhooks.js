import crypto from 'crypto';
import debug from 'debug';
import express from 'express';

import { appName, zoomApp } from '../../config.js';
import { extractExactGuess, submitWordleGuess } from '../wordle.js';

const router = express.Router();
const dbg = debug(`${appName}:zoom-webhooks`);
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function hmacSha256(value) {
    return crypto
        .createHmac('sha256', zoomApp.webhookSecretToken)
        .update(value)
        .digest('hex');
}

function sameValue(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    return (
        leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
}

function verifySignature(req) {
    const signature = req.get('x-zm-signature') || '';
    const timestamp = req.get('x-zm-request-timestamp') || '';
    const timestampSeconds = Number(timestamp);

    if (!signature || !timestamp || !Number.isFinite(timestampSeconds)) {
        return false;
    }

    const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
    if (ageSeconds > SIGNATURE_TOLERANCE_SECONDS) return false;

    const body = req.rawBody || JSON.stringify(req.body || {});
    const expected = `v0=${hmacSha256(`v0:${timestamp}:${body}`)}`;

    return sameValue(signature, expected);
}

function getChatPayload(body) {
    const object = body?.payload?.object || {};
    const chat =
        object.chat_message ||
        object.chatMessage ||
        object.message ||
        body?.payload?.chat_message ||
        {};

    return {
        message:
            chat.message_content ||
            chat.message ||
            chat.content ||
            object.message_content ||
            object.message ||
            '',
        player:
            chat.sender_name ||
            chat.sender?.name ||
            object.sender_name ||
            object.participant_user_name ||
            'Zoom Chat',
        room:
            object.uuid ||
            object.meeting_uuid ||
            object.meetingUUID ||
            object.webinar_uuid ||
            object.id ||
            body?.payload?.object?.uuid,
    };
}

function isChatMessageEvent(event) {
    return (
        event === 'meeting.chat_message_sent' ||
        event === 'webinar.chat_message_sent' ||
        event.includes('chat_message')
    );
}

router.post('/', (req, res) => {
    if (!zoomApp.webhookSecretToken) {
        res.status(503).json({
            error: 'ZOOM_WEBHOOK_SECRET_TOKEN is not configured',
        });
        return;
    }

    if (req.body?.event === 'endpoint.url_validation') {
        const plainToken = req.body?.payload?.plainToken;

        if (!plainToken) {
            res.status(400).json({ error: 'Missing plainToken' });
            return;
        }

        res.json({
            plainToken,
            encryptedToken: hmacSha256(plainToken),
        });
        return;
    }

    if (!verifySignature(req)) {
        res.status(401).json({ error: 'Invalid Zoom webhook signature' });
        return;
    }

    const event = String(req.body?.event || '');
    if (!isChatMessageEvent(event)) {
        res.json({ ignored: true, ok: true });
        return;
    }

    const { message, player, room } = getChatPayload(req.body);
    const word = extractExactGuess(message);

    if (!word) {
        res.json({
            accepted: false,
            ok: true,
            reason: 'not_a_single_five_letter_word',
        });
        return;
    }

    const result = submitWordleGuess({ player, room, word });

    if (!result.error) {
        req.app
            .get('io')
            ?.to(result.state.room)
            .emit('wordle:state', result.state);
        dbg('%s submitted %s in %s', player, word, result.state.room);
    }

    res.json({
        accepted: !result.error,
        error: result.error || null,
        ok: true,
        state: result.state,
    });
});

export default router;
