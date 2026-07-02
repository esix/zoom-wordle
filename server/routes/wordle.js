import express from 'express';
import {
    getWordleState,
    resetWordleGame,
    submitWordleGuess,
} from '../wordle.js';

const router = express.Router();

function roomFromRequest(req) {
    return req.body?.meetingUUID || req.body?.room || req.query?.meetingUUID;
}

function broadcastState(req, state) {
    req.app.get('io')?.to(state.room).emit('wordle:state', state);
}

router.get('/state', (req, res) => {
    res.json({
        state: getWordleState(roomFromRequest(req)),
    });
});

router.post('/guesses', (req, res) => {
    const result = submitWordleGuess({
        player: req.body?.player,
        room: roomFromRequest(req),
        word: req.body?.word,
    });

    if (!result.error) broadcastState(req, result.state);

    res.status(result.error ? 422 : 201).json(result);
});

router.post('/reset', (req, res) => {
    const state = resetWordleGame(roomFromRequest(req));

    broadcastState(req, state);

    res.json({ state });
});

export default router;
