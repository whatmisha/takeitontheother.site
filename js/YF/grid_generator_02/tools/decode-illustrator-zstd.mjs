// Research-only decoder. The browser-compatible dependency never enters the editor bundle.
import { Decompress } from 'fzstd';
const limit = 64 * 1024 * 1024;
let inputSize = 0, outputSize = 0;
const chunks = [];
const decoder = new Decompress(chunk => {
    outputSize += chunk.byteLength;
    if (outputSize > limit) throw new Error('Decoded Illustrator data exceeds the 64 MiB research limit');
    chunks.push(Buffer.from(chunk));
});
try {
    for await (const chunk of process.stdin) {
        inputSize += chunk.byteLength;
        if (inputSize > limit) throw new Error('Compressed Illustrator data exceeds the research limit');
        decoder.push(chunk);
    }
    decoder.push(new Uint8Array(0), true);
    process.stdout.write(Buffer.concat(chunks));
} catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
}
