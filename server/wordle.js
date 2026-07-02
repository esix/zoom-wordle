import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadWords(fileName) {
    const path = resolve(__dirname, '../data/wordlists', fileName);
    const words = JSON.parse(readFileSync(path, 'utf8'));

    return words.map((word) => word.toLocaleUpperCase('ru-RU'));
}

const ANSWERS = loadWords('ru-answers.json');
const ACCEPTED_GUESSES = new Set(loadWords('ru-guesses.json'));

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
        .toLocaleLowerCase('ru-RU')
        .replaceAll('ё', 'е');
    const token = text.match(/(^|[^а-я])([а-я]{5})(?=[^а-я]|$)/);

    if (token) return token[2].toLocaleUpperCase('ru-RU');

    const letters = Array.from(text)
        .filter((char) => /^[а-я]$/.test(char))
        .join('');

    return letters.length === WORD_LENGTH
        ? letters.toLocaleUpperCase('ru-RU')
        : '';
}

export function extractExactGuess(value) {
    const text = String(value || '')
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase('ru-RU')
        .replaceAll('ё', 'е');

    return /^[а-я]{5}$/.test(text) ? text.toLocaleUpperCase('ru-RU') : '';
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
            error: 'Нужно русское слово из пяти букв.',
            state: serializeGame(game),
        };
    }

    if (!ACCEPTED_GUESSES.has(guess)) {
        return {
            error: `${guess} нет в словаре.`,
            state: serializeGame(game),
        };
    }

    if (game.status !== 'playing') {
        return {
            error: 'Раунд уже закончен.',
            state: serializeGame(game),
        };
    }

    if (game.guesses.some((row) => row.word === guess)) {
        return {
            error: `${guess} уже было.`,
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
