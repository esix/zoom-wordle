import { mkdir, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const outputDir = resolve(rootDir, 'data/wordlists');

const sources = {
    frequency:
        'https://raw.githubusercontent.com/Digital-Pushkin-Lab/Russian-Word-Frequency-Lists-for-Children/main/wordlist_detcorpus_50000.csv',
    guesses: 'https://raw.githubusercontent.com/danakt/russian-words/master/russian.txt',
    nouns: 'https://raw.githubusercontent.com/Harrix/Russian-Nouns/main/dist/russian_nouns.txt',
};

const wordPattern = /^[а-я]{5}$/;

function normalizeWord(word) {
    return String(word || '')
        .normalize('NFKC')
        .trim()
        .toLocaleLowerCase('ru-RU')
        .replaceAll('ё', 'е');
}

async function fetchText(url, encoding = 'utf-8') {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    return new TextDecoder(encoding).decode(buffer);
}

function unique(values) {
    return [...new Set(values)];
}

function fiveLetterWordsFromLines(text) {
    return unique(
        text
            .split(/\r?\n/)
            .map(normalizeWord)
            .filter((word) => wordPattern.test(word))
    );
}

function frequencyWordsFromCsv(csv) {
    return unique(
        csv
            .split(/\r?\n/)
            .slice(1)
            .map((line) => normalizeWord(line.split(',')[0]))
            .filter((word) => wordPattern.test(word))
    );
}

async function main() {
    const [frequencyCsv, guessesText, nounsText] = await Promise.all([
        fetchText(sources.frequency),
        fetchText(sources.guesses, 'windows-1251'),
        fetchText(sources.nouns),
    ]);

    const guesses = fiveLetterWordsFromLines(guessesText).sort((a, b) =>
        a.localeCompare(b, 'ru')
    );
    const guessSet = new Set(guesses);
    const nounSet = new Set(fiveLetterWordsFromLines(nounsText));
    const answers = frequencyWordsFromCsv(frequencyCsv).filter(
        (word) => nounSet.has(word) && guessSet.has(word)
    );

    await mkdir(outputDir, { recursive: true });

    await writeFile(
        resolve(outputDir, 'ru-guesses.json'),
        `${JSON.stringify(guesses, null, 2)}\n`
    );
    await writeFile(
        resolve(outputDir, 'ru-answers.json'),
        `${JSON.stringify(answers, null, 2)}\n`
    );

    console.log(`Russian guesses: ${guesses.length}`);
    console.log(`Russian answers: ${answers.length}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
