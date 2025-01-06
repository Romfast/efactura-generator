// test/test-utils.js
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getFixturePath(filename) {
    return resolve(__dirname, 'fixtures', filename);
}

export function getProjectPath(filename) {
    return resolve(__dirname, '..', filename);
}

export async function loadTestFile(filename) {
    try {
        return await fs.promises.readFile(getProjectPath(filename), 'utf8');
    } catch (error) {
        console.error(`Error loading test file ${filename}:`, error);
        throw error;
    }
}

export async function loadFixture(filename) {
    try {
        return await fs.promises.readFile(getFixturePath(filename), 'utf8');
    } catch (error) {
        console.error(`Error loading fixture ${filename}:`, error);
        throw error;
    }
}