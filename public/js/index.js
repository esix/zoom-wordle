import app from './lib/immersive-app.js';

const board = {
    cols: 5,
    rows: 6,
    letters: 'WORDLE',
    tick: 0,
};

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

let timer = null;

function setStatus(text) {
    const el = document.getElementById('status');
    if (el) el.textContent = text;
}

function getVideoSize() {
    const width = app.video.width || 640;
    const height = app.video.height || 360;

    return { width, height };
}

function drawRoundedRect(x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function drawWordleGrid() {
    const { width, height } = getVideoSize();
    const changedSize = canvas.width !== width || canvas.height !== height;

    if (changedSize) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const shortSide = Math.min(width, height);
    const gap = Math.max(6, Math.round(shortSide * 0.018));
    const boardWidth = Math.min(width * 0.78, (height * 0.78 * 5) / 6);
    const cell = Math.floor((boardWidth - gap * (board.cols - 1)) / board.cols);
    const gridWidth = cell * board.cols + gap * (board.cols - 1);
    const gridHeight = cell * board.rows + gap * (board.rows - 1);
    const originX = Math.floor((width - gridWidth) / 2);
    const originY = Math.floor((height - gridHeight) / 2);
    const activeCount = board.tick % (board.cols * board.rows + 1);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.max(8, Math.round(shortSide * 0.025));

    for (let row = 0; row < board.rows; row++) {
        for (let col = 0; col < board.cols; col++) {
            const index = row * board.cols + col;
            const x = originX + col * (cell + gap);
            const y = originY + row * (cell + gap);
            const isActive = index < activeCount;
            const pulse = 0.5 + 0.5 * Math.sin((board.tick + index) * 0.9);

            ctx.lineWidth = Math.max(3, Math.round(cell * 0.055));
            ctx.strokeStyle = isActive
                ? `rgba(255, 255, 255, ${0.72 + pulse * 0.2})`
                : 'rgba(255, 255, 255, 0.34)';
            ctx.fillStyle = isActive
                ? `rgba(64, 140, 94, ${0.48 + pulse * 0.22})`
                : 'rgba(15, 18, 22, 0.2)';

            drawRoundedRect(x, y, cell, cell, Math.round(cell * 0.1));
            ctx.fill();
            ctx.stroke();

            if (!isActive) continue;

            const letter =
                board.letters[(index + board.tick) % board.letters.length];

            ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
            ctx.font = `900 ${Math.floor(cell * 0.58)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter, x + cell / 2, y + cell / 2 + cell * 0.03);
        }
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.font = `700 ${Math.max(
        16,
        Math.round(shortSide * 0.045)
    )}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
        'WORDLE TEST',
        width / 2,
        Math.max(12, originY - shortSide * 0.11)
    );
    ctx.restore();

    board.tick += 1;

    return ctx.getImageData(0, 0, width, height);
}

async function updateForeground() {
    try {
        const imageData = drawWordleGrid();
        await app.sdk.setVirtualForeground({
            imageData,
            persistence: 'meeting',
        });
        setStatus('Wordle grid is running on your video.');
    } catch (error) {
        console.error(error);
        setStatus(`Virtual foreground failed: ${error.message || error}`);
        window.clearInterval(timer);
        timer = null;
    }
}

function startTicker() {
    if (timer) window.clearInterval(timer);

    updateForeground();
    timer = window.setInterval(updateForeground, 700);
}

window.addEventListener('beforeunload', () => {
    if (timer) window.clearInterval(timer);
});

(async () => {
    try {
        setStatus('Starting Wordle video overlay...');
        await app.init();

        startTicker();
    } catch (error) {
        console.error(error);
        setStatus(`Zoom SDK init failed: ${error.message || error}`);
    }
})();
