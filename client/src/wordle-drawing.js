const COLORS = {
    absent: '#5c6670',
    correct: '#3f8f5e',
    emptyFill: 'rgba(15, 18, 22, 0.2)',
    emptyStroke: 'rgba(255, 255, 255, 0.38)',
    present: '#c9a646',
};

function drawRoundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
}

function getTitle(game) {
    if (game.status === 'solved') {
        const winner = game.guesses.at(-1)?.player || 'Team';

        return `${winner} solved it`;
    }

    if (game.status === 'failed') return `Word was ${game.answer}`;

    return 'WORDLE';
}

function getSubtitle(game) {
    const latest = game.guesses.at(-1);

    if (!latest) return 'Waiting for guesses';

    return `${latest.player}: ${latest.word}`;
}

export function drawWordleForeground(ctx, canvas, game, video, tick) {
    const width = video.width || 640;
    const height = video.height || 360;

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);

    const shortSide = Math.min(width, height);
    const wordLength = game.wordLength || 5;
    const maxGuesses = game.maxGuesses || 6;
    const gap = Math.max(6, Math.round(shortSide * 0.018));
    const boardWidth = Math.min(
        width * 0.78,
        (height * 0.72 * wordLength) / maxGuesses
    );
    const cell = Math.floor((boardWidth - gap * (wordLength - 1)) / wordLength);
    const gridWidth = cell * wordLength + gap * (wordLength - 1);
    const gridHeight = cell * maxGuesses + gap * (maxGuesses - 1);
    const originX = Math.floor((width - gridWidth) / 2);
    const originY = Math.floor((height - gridHeight) / 2);
    const activeRow = game.guesses?.length || 0;
    const pulse = 0.55 + 0.45 * Math.sin(tick * 0.8);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = Math.max(8, Math.round(shortSide * 0.025));

    for (let row = 0; row < maxGuesses; row++) {
        const guess = game.guesses?.[row];

        for (let col = 0; col < wordLength; col++) {
            const x = originX + col * (cell + gap);
            const y = originY + row * (cell + gap);
            const result = guess?.result?.[col];
            const isActiveEmpty =
                !guess && game.status === 'playing' && row === activeRow;

            ctx.lineWidth = Math.max(3, Math.round(cell * 0.055));
            ctx.strokeStyle = isActiveEmpty
                ? `rgba(255, 255, 255, ${0.48 + pulse * 0.28})`
                : COLORS.emptyStroke;
            ctx.fillStyle = result ? COLORS[result] : COLORS.emptyFill;

            drawRoundedRect(ctx, x, y, cell, cell, Math.round(cell * 0.1));
            ctx.fill();
            ctx.stroke();

            if (!guess) continue;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
            ctx.font = `900 ${Math.floor(cell * 0.58)}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                guess.word[col],
                x + cell / 2,
                y + cell / 2 + cell * 0.035
            );
        }
    }

    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.font = `800 ${Math.max(
        16,
        Math.round(shortSide * 0.048)
    )}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
        getTitle(game),
        width / 2,
        Math.max(10, originY - shortSide * 0.13)
    );

    ctx.font = `700 ${Math.max(
        12,
        Math.round(shortSide * 0.032)
    )}px Arial, sans-serif`;
    ctx.fillText(
        getSubtitle(game),
        width / 2,
        Math.min(height - 24, originY + gridHeight + gap * 1.6)
    );
    ctx.restore();

    return ctx.getImageData(0, 0, width, height);
}
