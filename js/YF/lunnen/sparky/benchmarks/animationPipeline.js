import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    stat,
    writeFile
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEFAULT_OUTPUT = join(PROJECT_ROOT, 'benchmarks/results/animation-baseline.json');
const CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
];
const MIME_TYPES = Object.freeze({
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2'
});

const delay = (duration) => new Promise((resolveDelay) => setTimeout(resolveDelay, duration));

function parseArguments(argv) {
    const parsed = { profile: 'standard', output: DEFAULT_OUTPUT, chrome: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--quick') parsed.profile = 'quick';
        else if (argument === '--output') parsed.output = resolve(argv[++index]);
        else if (argument.startsWith('--output=')) parsed.output = resolve(argument.slice(9));
        else if (argument === '--chrome') parsed.chrome = resolve(argv[++index]);
        else if (argument.startsWith('--chrome=')) parsed.chrome = resolve(argument.slice(9));
        else throw new Error(`Unknown benchmark argument: ${argument}`);
    }
    return parsed;
}

async function executableChrome(requested) {
    const candidates = requested ? [requested] : CHROME_CANDIDATES;
    for (const candidate of candidates) {
        try {
            const info = await stat(candidate);
            if (info.isFile()) return candidate;
        } catch {
            // Continue through known browser locations.
        }
    }
    throw new Error('Google Chrome or Chromium is required for animation benchmark.');
}

function staticFile(pathname) {
    const decoded = decodeURIComponent(pathname === '/' ? '/benchmarks/animationPipeline.html' : pathname);
    const file = resolve(PROJECT_ROOT, `.${decoded}`);
    const traversal = relative(PROJECT_ROOT, file);
    if (traversal.startsWith(`..${sep}`) || traversal === '..' || isAbsolute(traversal)) return null;
    return file;
}

async function startServer() {
    const server = createServer(async (request, response) => {
        const file = staticFile(new URL(request.url, 'http://127.0.0.1').pathname);
        if (!file) {
            response.writeHead(403).end('Forbidden');
            return;
        }
        try {
            const info = await stat(file);
            if (!info.isFile()) throw new Error('Not a file');
            response.writeHead(200, {
                'Content-Type': MIME_TYPES[extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                'Cache-Control': 'no-store',
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
                'Cross-Origin-Resource-Policy': 'same-origin'
            });
            createReadStream(file).pipe(response);
        } catch {
            response.writeHead(404).end('Not found');
        }
    });
    await new Promise((resolveListen, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolveListen);
    });
    return {
        server,
        origin: `http://127.0.0.1:${server.address().port}`
    };
}

async function waitForDevToolsPort(profileDirectory, chrome, timeoutMs = 15000) {
    const portFile = join(profileDirectory, 'DevToolsActivePort');
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (chrome.exitCode != null) {
            throw new Error(`Headless Chrome exited before DevTools was ready (${chrome.exitCode}).`);
        }
        try {
            const [port] = (await readFile(portFile, 'utf8')).trim().split(/\s+/);
            if (Number(port) > 0) return Number(port);
        } catch {
            // Chrome creates DevToolsActivePort after its profile is ready.
        }
        await delay(50);
    }
    throw new Error('Timed out while starting headless Chrome.');
}

class CdpClient {
    constructor(url) {
        this.socket = new WebSocket(url);
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = new Map();
        this.ready = new Promise((resolveReady, reject) => {
            this.socket.addEventListener('open', resolveReady, { once: true });
            this.socket.addEventListener('error', reject, { once: true });
        });
        this.socket.addEventListener('message', (event) => this.receive(event));
    }

    receive(event) {
        const message = JSON.parse(event.data);
        if (message.id) {
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            if (message.error) pending.reject(new Error(message.error.message));
            else pending.resolve(message.result);
            return;
        }
        const waiting = this.listeners.get(message.method);
        if (!waiting?.length) return;
        this.listeners.set(message.method, []);
        waiting.forEach((resolveEvent) => resolveEvent(message.params));
    }

    async send(method, params = {}) {
        await this.ready;
        const id = this.nextId++;
        const result = new Promise((resolveResult, reject) => {
            this.pending.set(id, { resolve: resolveResult, reject });
        });
        this.socket.send(JSON.stringify({ id, method, params }));
        return result;
    }

    waitFor(method) {
        return new Promise((resolveEvent) => {
            const listeners = this.listeners.get(method) || [];
            listeners.push(resolveEvent);
            this.listeners.set(method, listeners);
        });
    }

    close() {
        this.socket.close();
    }
}

async function browserTarget(port) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) throw new Error(`Chrome DevTools target lookup failed: ${response.status}`);
    const targets = await response.json();
    const target = targets.find((candidate) => candidate.type === 'page');
    if (!target?.webSocketDebuggerUrl) throw new Error('Headless Chrome did not expose a page target.');
    return target.webSocketDebuggerUrl;
}

async function runInChrome(origin, profile, chromePath) {
    const profileDirectory = await mkdtemp(join(tmpdir(), 'sparky-animation-benchmark-'));
    const chromeLogs = [];
    const chrome = spawn(chromePath, [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profileDirectory}`,
        '--enable-precise-memory-info',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-default-apps',
        '--no-default-browser-check',
        '--no-first-run',
        'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.setEncoding('utf8');
    chrome.stderr.on('data', (chunk) => {
        chromeLogs.push(chunk);
        if (chromeLogs.length > 20) chromeLogs.shift();
    });

    let client;
    try {
        const port = await waitForDevToolsPort(profileDirectory, chrome);
        client = new CdpClient(await browserTarget(port));
        await client.send('Page.enable');
        await client.send('Runtime.enable');
        const loaded = client.waitFor('Page.loadEventFired');
        await client.send('Page.navigate', {
            url: `${origin}/benchmarks/animationPipeline.html`
        });
        await loaded;
        const expression = `import('/benchmarks/animationPipelineBrowser.js?run=${Date.now()}')`
            + `.then(module => module.runAnimationPipelineBenchmark(${JSON.stringify({ profile })}))`;
        const evaluated = await client.send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true
        });
        if (evaluated.exceptionDetails) {
            throw new Error(
                evaluated.exceptionDetails.exception?.description
                || evaluated.exceptionDetails.text
                || 'Animation benchmark failed in Chrome.'
            );
        }
        return evaluated.result.value;
    } catch (error) {
        const diagnostics = chromeLogs.join('').trim();
        if (diagnostics) error.message += `\nChrome diagnostics:\n${diagnostics}`;
        throw error;
    } finally {
        client?.close();
        if (chrome.exitCode == null) chrome.kill('SIGTERM');
        await rm(profileDirectory, { recursive: true, force: true });
    }
}

const options = parseArguments(process.argv.slice(2));
const chromePath = await executableChrome(options.chrome);
const { server, origin } = await startServer();

try {
    const report = await runInChrome(origin, options.profile, chromePath);
    report.runner = {
        chromePath,
        projectRoot: PROJECT_ROOT,
        command: options.profile === 'quick'
            ? 'npm run benchmark:animation -- --quick'
            : 'npm run benchmark:animation'
    };
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
        passed: report.passed,
        profile: report.profile,
        output: options.output,
        preview: report.preview.map((entry) => ({
            scenario: entry.scenario.id,
            meanMs: entry.total.meanMs,
            p95Ms: entry.total.p95Ms,
            droppedFrames: entry.total.droppedFrames,
            slowestFrame: entry.slowFrames?.[0] || null
        })),
        exports: report.exports.map((entry) => ({
            scenario: entry.scenario.id,
            format: entry.format,
            status: entry.status,
            framesPerSecond: entry.wallFramesPerSecond,
            peakKnownBytes: entry.worker?.peakKnownBytes,
            error: entry.error
        }))
    }, null, 2));
    if (!report.passed) process.exitCode = 1;
} finally {
    await new Promise((resolveClose) => server.close(resolveClose));
}
