// scripts/test-counter.ts
import 'dotenv/config';
import { addToCharacterCounter, getCharacterCounter } from '../lib/elevenlabs';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const USAGE_FILE = join(process.cwd(), 'usage.csv');

function test() {
    console.log('🧪 Testing Character Counter...');

    // Cleanup existing file for a fresh test
    if (existsSync(USAGE_FILE)) {
        unlinkSync(USAGE_FILE);
    }

    const initial = getCharacterCounter();
    console.log(`Initial count: ${initial} (expected 0)`);
    if (initial !== 0) throw new Error('Initial count should be 0');

    addToCharacterCounter(100);
    const afterFirst = getCharacterCounter();
    console.log(`Count after adding 100: ${afterFirst} (expected 100)`);
    if (afterFirst !== 100) throw new Error('Count should be 100');

    addToCharacterCounter(50);
    const afterSecond = getCharacterCounter();
    console.log(`Count after adding 50: ${afterSecond} (expected 150)`);
    if (afterSecond !== 150) throw new Error('Count should be 150');

    console.log('✅ Character counter test passed!');
}

try {
    test();
} catch (err: any) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
}
