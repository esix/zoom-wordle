const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

const ANSWERS = [
    'ABOUT',
    'BRAIN',
    'CHAIR',
    'CRANE',
    'DREAM',
    'EARTH',
    'FRAME',
    'GRACE',
    'HEART',
    'LIGHT',
    'MOUSE',
    'PLANT',
    'REACT',
    'SHARE',
    'SMILE',
    'SOUND',
    'STONE',
    'TABLE',
    'VIDEO',
    'WORLD',
];

const rooms = new Map();

function hashString(value) {
    let hash = 0;

    for (const char of value) {
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0;
    }

    return Math.abs(hash);
}

export function normalizeRoomId(room) {
    const value = String(room || 'local').trim();

    return value ? value.slice(0, 160) : 'local';
}

function chooseAnswer(room, round) {
    const day = Math.floor(Date.now() / 86_400_000);
    const index = hashString(`${room}:${day}:${round}`) % ANSWERS.length;

    return ANSWERS[index];
}

function createGame(room, round = 1) {
    const now = Date.now();

    return {
        answer: chooseAnswer(room, round),
        guesses: [],
        maxGuesses: MAX_GUESSES,
        room,
        round,
        startedAt: now,
        status: 'playing',
        updatedAt: now,
        wordLength: WORD_LENGTH,
    };
}

function getGame(room) {
    const roomId = normalizeRoomId(room);

    if (!rooms.has(roomId)) rooms.set(roomId, createGame(roomId));

    return rooms.get(roomId);
}

function serializeGame(game) {
    return {
        answer: game.status === 'playing' ? null : game.answer,
        guesses: game.guesses,
        maxGuesses: game.maxGuesses,
        remainingGuesses: game.maxGuesses - game.guesses.length,
        room: game.room,
        round: game.round,
        startedAt: game.startedAt,
        status: game.status,
        updatedAt: game.updatedAt,
        wordLength: game.wordLength,
    };
}

function scoreGuess(guess, answer) {
    const result = Array.from({ length: WORD_LENGTH }, () => 'absent');
    const remaining = new Map();

    for (let index = 0; index < WORD_LENGTH; index++) {
        if (guess[index] === answer[index]) {
            result[index] = 'correct';
            continue;
        }

        remaining.set(answer[index], (remaining.get(answer[index]) || 0) + 1);
    }

    for (let index = 0; index < WORD_LENGTH; index++) {
        if (result[index] === 'correct') continue;

        const letter = guess[index];
        const count = remaining.get(letter) || 0;

        if (count > 0) {
            result[index] = 'present';
            remaining.set(letter, count - 1);
        }
    }

    return result;
}

function cleanPlayer(player) {
    const value = String(player || 'Chat').trim();

    return value ? value.slice(0, 40) : 'Chat';
}

export function extractGuess(value) {
    const text = String(value || '')
        .normalize('NFKC')
        .toUpperCase();
    const token = text.match(/\b[A-Z]{5}\b/);

    if (token) return token[0];

    const letters = Array.from(text)
        .filter((char) => /^[A-Z]$/.test(char))
        .join('');

    return letters.length === WORD_LENGTH ? letters : '';
}

export function getWordleState(room) {
    return serializeGame(getGame(room));
}

export function resetWordleGame(room) {
    const roomId = normalizeRoomId(room);
    const previousRound = rooms.get(roomId)?.round || 0;
    const game = createGame(roomId, previousRound + 1);

    rooms.set(roomId, game);

    return serializeGame(game);
}

export function submitWordleGuess({ room, word, player }) {
    const game = getGame(room);
    const guess = extractGuess(word);

    if (!guess) {
        return {
            error: 'Only five-letter English words are accepted right now.',
            state: serializeGame(game),
        };
    }

    if (game.status !== 'playing') {
        return {
            error: 'This round is already finished.',
            state: serializeGame(game),
        };
    }

    if (game.guesses.some((row) => row.word === guess)) {
        return {
            error: `${guess} was already guessed.`,
            state: serializeGame(game),
        };
    }

    const row = {
        player: cleanPlayer(player),
        result: scoreGuess(guess, game.answer),
        timestamp: Date.now(),
        word: guess,
    };

    game.guesses.push(row);

    if (guess === game.answer) game.status = 'solved';
    else if (game.guesses.length >= game.maxGuesses) game.status = 'failed';

    game.updatedAt = row.timestamp;

    return {
        guess: row,
        state: serializeGame(game),
    };
}
