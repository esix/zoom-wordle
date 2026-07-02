import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import './styles.css';
import zoomApp from './zoom-app.js';
import { drawWordleForeground } from './wordle-drawing.js';

const emptyGame = {
    answer: null,
    guesses: [],
    maxGuesses: 6,
    remainingGuesses: 6,
    room: 'local',
    round: 1,
    status: 'playing',
    wordLength: 5,
};

function getBasePath() {
    const base = import.meta.env.BASE_URL || '/';

    if (base === '/') return '';

    return base.replace(/\/+$/, '');
}

function isMountedUnderBasePath() {
    const base = getBasePath();

    return Boolean(
        base &&
            (window.location.pathname === base ||
                window.location.pathname.startsWith(`${base}/`))
    );
}

function getSocketPath() {
    return isMountedUnderBasePath()
        ? `${getBasePath()}/socket.io`
        : '/socket.io';
}

function getApiBasePath() {
    return isMountedUnderBasePath()
        ? `${getBasePath()}/api/wordle`
        : '/api/wordle';
}

function cleanGuessInput(value) {
    return value
        .normalize('NFKC')
        .toLocaleUpperCase('ru-RU')
        .replace(/Ё/g, 'Е')
        .replace(/[^А-Я]/g, '')
        .slice(0, 5);
}

function getGameLine(game) {
    if (game.status === 'solved') {
        const winner = game.guesses.at(-1)?.player || 'Команда';

        return `${winner}: ${game.guesses.at(-1)?.word || 'угадано'}`;
    }

    if (game.status === 'failed') return `Ответ: ${game.answer}`;

    return `Осталось попыток: ${game.remainingGuesses}`;
}

function useZoomIdentity() {
    const [identity, setIdentity] = useState({
        meetingUUID: null,
        player: 'Ведущий',
        status: 'Запускаю Zoom SDK...',
        zoomReady: false,
    });

    useEffect(() => {
        let cancelled = false;

        async function start() {
            try {
                await zoomApp.init();

                const [meeting, user] = await Promise.allSettled([
                    zoomApp.loadMeetingUUID(),
                    zoomApp.loadUserContext(),
                ]);

                if (cancelled) return;

                setIdentity({
                    meetingUUID:
                        meeting.status === 'fulfilled' && meeting.value
                            ? meeting.value
                            : 'local',
                    player:
                        user.status === 'fulfilled' && user.value?.screenName
                            ? user.value.screenName
                            : 'Ведущий',
                    status: 'Zoom SDK подключен.',
                    zoomReady: true,
                });
            } catch (error) {
                console.error(error);
                if (cancelled) return;

                setIdentity({
                    meetingUUID: 'local',
                    player: 'Ведущий',
                    status: `Zoom SDK недоступен: ${error.message || error}`,
                    zoomReady: false,
                });
            }
        }

        start();

        return () => {
            cancelled = true;
        };
    }, []);

    return identity;
}

function useWordleSocket(meetingUUID) {
    const [connectionStatus, setConnectionStatus] = useState(
        'Подключаю игровой сервер...'
    );
    const [error, setError] = useState('');
    const [game, setGame] = useState(emptyGame);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!meetingUUID) return undefined;

        const socket = io({
            path: getSocketPath(),
            transports: ['websocket'],
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            setConnectionStatus('Игровой сервер подключен.');
            socket.emit('wordle:join', { meetingUUID });
        });

        socket.on('disconnect', () => {
            setConnectionStatus('Игровой сервер отключен.');
        });

        socket.on('connect_error', (nextError) => {
            setConnectionStatus(
                `Ошибка игрового сервера: ${nextError.message}`
            );
        });

        socket.on('wordle:state', (nextGame) => {
            setError('');
            setGame(nextGame);
        });

        socket.on('wordle:error', ({ message } = {}) => {
            setError(message || 'Слово отклонено.');
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [meetingUUID]);

    async function postToApi(path, body) {
        const response = await fetch(`${getApiBasePath()}${path}`, {
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
            },
            method: 'POST',
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Запрос не удался.');

        if (data.state) setGame(data.state);

        return data;
    }

    async function submitGuess(word, player) {
        const payload = { meetingUUID, player, word };
        const socket = socketRef.current;

        setError('');

        if (socket?.connected) {
            socket.emit('wordle:guess', payload);
            return;
        }

        try {
            await postToApi('/guesses', payload);
        } catch (nextError) {
            setError(nextError.message || String(nextError));
        }
    }

    async function resetGame() {
        const payload = { meetingUUID };
        const socket = socketRef.current;

        setError('');

        if (socket?.connected) {
            socket.emit('wordle:reset', payload);
            return;
        }

        try {
            await postToApi('/reset', payload);
        } catch (nextError) {
            setError(nextError.message || String(nextError));
        }
    }

    return {
        connectionStatus,
        error,
        game,
        resetGame,
        submitGuess,
    };
}

function useWordleForeground(game, enabled) {
    const [status, setStatus] = useState('Видео ждет Zoom...');
    const canvasRef = useRef(null);
    const gameRef = useRef(game);
    const tickRef = useRef(0);
    const timerRef = useRef(null);

    useEffect(() => {
        gameRef.current = game;
    }, [game]);

    useEffect(() => {
        if (!enabled) {
            setStatus('Видео-слой не активен вне Zoom.');
            return undefined;
        }

        let cancelled = false;

        async function updateForeground() {
            try {
                const canvas =
                    canvasRef.current || document.createElement('canvas');
                const ctx = canvas.getContext('2d', {
                    willReadFrequently: true,
                });
                canvasRef.current = canvas;

                const imageData = drawWordleForeground(
                    ctx,
                    canvas,
                    gameRef.current,
                    zoomApp.video,
                    tickRef.current
                );

                tickRef.current += 1;

                await zoomApp.sdk.setVirtualForeground({
                    imageData,
                    persistence: 'meeting',
                });

                if (!cancelled) setStatus('Доска Wordle уже в твоем видео.');
            } catch (error) {
                console.error(error);
                if (!cancelled) {
                    setStatus(
                        `Видео-слой не обновился: ${error.message || error}`
                    );
                }
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }

        updateForeground();
        timerRef.current = window.setInterval(updateForeground, 450);

        return () => {
            cancelled = true;
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [enabled]);

    return status;
}

function Board({ game }) {
    const rows = Array.from({ length: game.maxGuesses || 6 });

    return (
        <div className="board" aria-label="Доска Wordle">
            {rows.map((_, rowIndex) => {
                const guess = game.guesses[rowIndex];
                const isActive =
                    !guess &&
                    game.status === 'playing' &&
                    rowIndex === game.guesses.length;

                return Array.from({ length: game.wordLength || 5 }).map(
                    (__, colIndex) => (
                        <div
                            className={`tile ${
                                guess?.result?.[colIndex] || ''
                            } ${isActive ? 'active' : ''}`}
                            key={`${rowIndex}-${colIndex}`}
                        >
                            {guess?.word?.[colIndex] || ''}
                        </div>
                    )
                );
            })}
        </div>
    );
}

function App() {
    const identity = useZoomIdentity();
    const { connectionStatus, error, game, resetGame, submitGuess } =
        useWordleSocket(identity.meetingUUID);
    const foregroundStatus = useWordleForeground(game, identity.zoomReady);
    const [guess, setGuess] = useState('');

    function handleSubmit(event) {
        event.preventDefault();
        submitGuess(guess, identity.player);
        setGuess('');
    }

    return (
        <main className="app-shell">
            <section className="panel">
                <header className="panel-header">
                    <div>
                        <p className="eyebrow">Zoom Wordle</p>
                        <h1>5 букв</h1>
                    </div>
                    <span className={`round-pill ${game.status}`}>
                        Раунд {game.round}
                    </span>
                </header>

                <Board game={game} />

                <p className="game-line">{getGameLine(game)}</p>

                <form className="controls" onSubmit={handleSubmit}>
                    <input
                        aria-label="Слово"
                        disabled={game.status !== 'playing'}
                        maxLength="5"
                        onChange={(event) =>
                            setGuess(cleanGuessInput(event.target.value))
                        }
                        placeholder="СЛОВО"
                        value={guess}
                    />
                    <button
                        disabled={
                            guess.length !== 5 || game.status !== 'playing'
                        }
                        type="submit"
                    >
                        Ок
                    </button>
                    <button onClick={resetGame} type="button">
                        Сброс
                    </button>
                </form>

                <div className="status-stack">
                    <p className="status">{foregroundStatus}</p>
                    <p className="status">{connectionStatus}</p>
                    <p className="status">{identity.status}</p>
                    {error ? <p className="error">{error}</p> : null}
                </div>
            </section>
        </main>
    );
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>
);
