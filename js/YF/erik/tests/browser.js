import { DEFAULTS, normalize, framePlan, WIDTH, HEIGHT, sceneAt } from '../model.js';
import { loadFont, CrawlRenderer } from '../renderer.js';
import { Exporter } from '../exporter.js';
const reports = [], assert = (ok, message) => { if (!ok) throw new Error(message); };
function record(name, detail = '') { const item = document.createElement('li'); item.textContent = `PASS · ${name}${detail ? ' · ' + detail : ''}`; document.getElementById('results').append(item); reports.push({ name, status: 'passed', detail }); }
const pixels = async blob => {
    const image = await createImageBitmap(blob), canvas = new OffscreenCanvas(WIDTH, HEIGHT), ctx = canvas.getContext('2d');
    assert(image.width === WIDTH && image.height === HEIGHT, 'PNG dimensions');
    ctx.drawImage(image, 0, 0); image.close(); return ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
};
const alphaCount = data => { let count = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) count++; return count; };
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const link = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.textContent = name; a.style.marginRight = '20px'; document.getElementById('downloads').append(a); };
let renderer;
try {
    await loadFont(); renderer = new CrawlRenderer();
    const s = normalize(), layout = renderer.prepare(s), plan = framePlan(s, layout);
    assert(layout.lines.length === 14, 'Default credits should retain their fourteen lines');
    const transparent = t => renderer.render(s, t, { transparent: true }).convertToBlob({ type: 'image/png' });
    const opening = await pixels(await transparent(0));
    assert(alphaCount(opening) > 5000, 'First frame should contain the logo');
    const top = [], bottom = [], left = [], right = [];
    for (let x = 0; x < WIDTH; x++) { top.push(opening[x * 4 + 3]); bottom.push(opening[((HEIGHT - 1) * WIDTH + x) * 4 + 3]); }
    for (let y = 0; y < HEIGHT; y++) { left.push(opening[(y * WIDTH) * 4 + 3]); right.push(opening[(y * WIDTH + WIDTH - 1) * 4 + 3]); }
    assert([top, bottom, left, right].every(edge => edge.some(alpha => alpha > 0)), 'Fill logo should reach all four frame edges');
    record('Opening logo fills the frame and crops overflow');
    assert(alphaCount(await pixels(await transparent(plan.lastTime))) === 0, 'Last frame should be blank');
    const sheet = document.getElementById('stages'), sheetContext = sheet.getContext('2d');
    for (const [index, time] of [0, 1, 3.7, 9].entries()) {
        sheetContext.drawImage(renderer.render(s, time), index % 2 * 960, Math.floor(index / 2) * 580, 960, 540);
        sheetContext.fillStyle = '#ddd'; sheetContext.font = '20px system-ui';
        sheetContext.fillText(`${time.toFixed(1)} s`, index % 2 * 960 + 20, Math.floor(index / 2) * 580 + 565);
    }
    link(await new Promise(resolve => sheet.toBlob(resolve)), 'erik-stages.png');
    const logoOnly = { ...s, body: '' };
    const before = await pixels(await transparent(89 / 30));
    const logoBefore = await pixels(await renderer.render(logoOnly, 89 / 30, { transparent: true }).convertToBlob());
    assert(equal(before, logoBefore), 'Crawl appeared before the intro ends');
    const overlap = await pixels(await transparent(4));
    const logoOverlap = await pixels(await renderer.render(logoOnly, 4, { transparent: true }).convertToBlob());
    assert(alphaCount(logoOverlap) > 0 && alphaCount(overlap) > alphaCount(logoOverlap), 'Logo/crawl overlap is missing');
    record('Logo precedes crawl, then both are visible during the handoff');
    const slowLogo = await pixels(await renderer.render({ ...logoOnly, speed: s.speed / 2 }, 8, { transparent: true }).convertToBlob());
    assert(equal(logoOverlap, slowLogo), 'Logo does not follow the shared Speed setting');
    const earlierLogo = await pixels(await renderer.render(logoOnly, 1, { transparent: true }).convertToBlob());
    assert(!equal(logoOverlap, earlierLogo), 'Logo is not moving');
    const overlapExport = await new Exporter().run('frame', s, 4);
    assert(equal(overlap, await pixels(overlapExport.blob)), 'Logo/crawl overlap differs in worker export');
    record('Shared Speed controls logo motion; overlapping logo and crawl match worker export');
    record('Visible opening logo and empty final frame', `${plan.frames} frames / ${plan.duration.toFixed(3)} s`);
    const frameBlob = await transparent(12), first = await pixels(frameBlob);
    assert(alphaCount(first) > 5000 && alphaCount(first) < WIDTH * HEIGHT / 2, 'Expected visible text on transparency');
    assert(first[3] === 0 && first.at(-1) === 0, 'Transparent corners');
    document.getElementById('preview').getContext('2d').drawImage(await createImageBitmap(frameBlob), 0, 0);
    await transparent(20);
    assert(equal(first, await pixels(await transparent(12))), 'Random access changed pixels');
    record('Deterministic random access and transparent 1080p PNG');
    const larger = await pixels(await renderer.render({ ...s, fontSize: 60 }, 12, { transparent: true }).convertToBlob());
    assert(!equal(first, larger), 'Font size must change the crawl');
    const largerExport = await new Exporter().run('frame', { ...s, fontSize: 60 }, 12);
    assert(equal(larger, await pixels(largerExport.blob)), 'Font size differs between preview and export');
    record('Font size changes the crawl and matches the exported PNG');
    const spacedSettings = { ...s, logoGap: 720, lineHeight: 2.2 };
    const spaced = await pixels(await renderer.render(spacedSettings, 12, { transparent: true }).convertToBlob());
    assert(!equal(first, spaced), 'Gap and line spacing must change the crawl');
    const spacedExport = await new Exporter().run('frame', spacedSettings, 12);
    assert(equal(spaced, await pixels(spacedExport.blob)), 'Gap/spacing differ between preview and export');
    const delayed = await pixels(await renderer.render({ ...s, logoGap: 720 }, 4, { transparent: true }).convertToBlob());
    assert(equal(delayed, logoOverlap), 'Larger gap must delay the crawl without changing the logo');
    record('Logo gap delays text independently; line spacing and gap match exported PNG');
    const changed = await pixels(await renderer.render({ ...s, tilt: 40 }, 12, { transparent: true }).convertToBlob({ type: 'image/png' }));
    assert(!equal(first, changed), 'Tilt must alter geometry');
    record('Tilt changes projected geometry');
    const workerFrame = await new Exporter().run('frame', s, 12);
    assert(equal(first, await pixels(workerFrame.blob)), 'Worker and preview raster differ');
    record('Worker PNG matches full-resolution preview pixel-for-pixel'); link(workerFrame.blob, 'erik-frame.png');
    // Reproduce the reported 00:05:28 contact with the original 240-unit gap.
    const regression = normalize({ logoGap: 240, fontSize: 36, speed: 120, tilt: 62, perspective: 100 });
    const regressionFade = renderer.prepare(regression).logoFade, regressionTime = 178 / 30;
    assert(sceneAt(regression, regressionTime, regressionFade).logoAlpha === 0, 'Logo survives into reported contact');
    const safeFrame = await pixels(await renderer.render(regression, regressionTime, { transparent: true }).convertToBlob());
    const crawlOnly = await pixels(await renderer.render({ ...regression, title: '' }, regressionTime - regression.logoGap / regression.speed, { transparent: true }).convertToBlob());
    assert(equal(safeFrame, crawlOnly), 'Contact frame still contains logo pixels');
    const safeExport = await new Exporter().run('frame', regression, regressionTime);
    assert(equal(safeFrame, await pixels(safeExport.blob)), 'Automatic fade differs in worker export');
    const regressionSheet = document.getElementById('collision'), regressionContext = regressionSheet.getContext('2d');
    for (const [index, time] of [regressionFade.start / regression.speed, (regressionFade.start + regressionFade.end) / 2 / regression.speed, regressionTime].entries()) {
        regressionContext.drawImage(renderer.render(regression, time), index * 640, 0, 640, 360);
        regressionContext.fillStyle = '#ddd'; regressionContext.font = '18px system-ui';
        regressionContext.fillText(`${time.toFixed(2)} s · logo ${Math.round(sceneAt(regression, time, regressionFade).logoAlpha * 100)}%`, index * 640 + 16, 390);
    }
    link(await new Promise(resolve => regressionSheet.toBlob(resolve)), 'erik-collision.png');
    record('00:05:28 regression: logo gone before contact; worker PNG matches', `Fade ${ (regressionFade.start / regression.speed).toFixed(3) }–${ (regressionFade.end / regression.speed).toFixed(3) } s`);
    const cases = [
        regression, s,
        normalize({ tilt: 30, perspective: 60, columnWidth: 600, fontSize: 120, lineHeight: .8, tracking: 8, logoGap: 10, speed: 400 }),
        normalize({ tilt: 80, perspective: 180, columnWidth: 1500, fontSize: 32, lineHeight: 3, tracking: -2, logoGap: 720, speed: 10 }),
        normalize({ title: 'W'.repeat(200), logoGap: 0, weight: 100, alignment: 'left' }),
        normalize({ title: Array(20).fill('I').join('\n'), logoGap: 360, alignment: 'center' }),
        normalize({ body: '\n\nÉÎÅ Съешь ещё этих мягких булок\n👩‍🚀 motion', fontSize: 120, lineHeight: .8, tilt: 30, perspective: 180, logoGap: 0 }),
        normalize({ logoGap: 2400, weight: 100, lineHeight: 3, tilt: 80, perspective: 60 })
    ];
    const raster = (settings, time) => {
        renderer.render(settings, time, { transparent: true });
        const data = new Uint8Array(WIDTH * HEIGHT * 4), gl = renderer.gl;
        gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, data);
        return data;
    };
    let separatedFrames = 0;
    for (const settings of cases) {
        const fade = { ...renderer.prepare(settings).logoFade };
        for (const ratio of [.1, .25, .5, .75, .9, .99]) {
            const time = fade.end * ratio / settings.speed;
            if (time * settings.speed < settings.logoGap || sceneAt(settings, time, fade).logoAlpha <= 0) continue;
            const logo = raster({ ...settings, body: '' }, time);
            const body = raster({ ...settings, title: '' }, time - settings.logoGap / settings.speed);
            for (let i = 3; i < logo.length; i += 4) assert(!(logo[i] && body[i]), `Raster collision at ${time} s`);
            separatedFrames++;
        }
        assert(sceneAt(settings, (fade.end + 1) / settings.speed, fade).logoAlpha === 0, 'Logo reappears after fade');
    }
    record('Real glyph rasters never overlap across extreme settings', `${cases.length} configurations / ${separatedFrames} simultaneous-stage frames`);
    const initialFade = { ...renderer.prepare(s).logoFade };
    assert(renderer.prepare({ ...s, logoGap: 0 }).logoFade.end < initialFade.end, 'Gap change did not refresh collision deadline');
    assert(renderer.prepare({ ...s, tilt: 30 }).logoFade.end !== initialFade.end, 'Tilt change did not refresh collision deadline');
    assert(renderer.prepare({ ...s, perspective: 180 }).logoFade.end !== initialFade.end, 'Perspective change did not refresh collision deadline');
    assert(renderer.prepare({ ...s, title: Array(10).fill('I').join('\n') }).logoFade.end !== initialFade.end, 'Logo change did not refresh collision deadline');
    assert(renderer.prepare({ ...s, speed: 10 }).logoFade.end === initialFade.end, 'Speed altered spatial fade deadline');
    record('Fade recalculates after geometry edits while Speed preserves its spatial deadline');
    const cyrillic = normalize({ title: 'НОВАЯ ПЕРСПЕКТИВА', body: 'Буквы уходят вдаль.\n\nСъешь ещё этих мягких французских булок, да выпей чаю.' });
    const russian = await pixels(await renderer.render(cyrillic, 10, { transparent: true }).convertToBlob({ type: 'image/png' }));
    assert(alphaCount(russian) > 5000, 'Cyrillic did not render'); record('Cyrillic text and paragraphs render');
    const brief = normalize({ title: 'Lunnen\nAiris', body: 'art director @enhanser', speed: 400, tilt: 80, perspective: 180 });
    const expected = framePlan(brief, renderer.prepare(brief));
    const sequence = await new Exporter(({ completed, total }) => { document.getElementById('state').textContent = `PNG sequence: ${completed}/${total}`; }).run('sequence', brief, 0);
    const bytes = new Uint8Array(await sequence.blob.arrayBuffer()), view = new DataView(bytes.buffer);
    let offset = 0; const entries = [];
    while (view.getUint32(offset, true) === 0x04034b50) {
        const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
        const start = offset + 30 + nameLength + extra;
        entries.push({ name: new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength)), blob: new Blob([bytes.slice(start, start + length)], { type: 'image/png' }) }); offset = start + length;
    }
    assert(entries.length === expected.frames, 'Sequence frame count');
    assert(entries[0].name === 'erik-00000.png' && entries.at(-1).name === `erik-${String(expected.frames - 1).padStart(5, '0')}.png`, 'Sequence names');
    assert(alphaCount(await pixels(entries[0].blob)) > 5000 && alphaCount(await pixels(entries.at(-1).blob)) === 0, 'Sequence boundary alpha');
    assert(alphaCount(await pixels(entries[Math.floor(entries.length / 3)].blob)) > 10, 'Sequence middle is blank');
    record('Complete ZIP: sequential names, exact frame count, transparent PNG', `${entries.length} frames / ${sequence.blob.size} bytes`); link(sequence.blob, 'erik-sequence.zip');
    let cancellation;
    const cancelled = new Exporter(() => cancelled.cancel());
    try { await cancelled.run('sequence', s, 0); } catch (error) { cancellation = error; }
    assert(cancellation?.name === 'AbortError' && !cancelled.busy, 'Cancellation failed');
    const afterCancel = await cancelled.run('frame', s, 12);
    assert(equal(first, await pixels(afterCancel.blob)), 'Retry after cancellation');
    record('Export cancellation releases worker; next export succeeds');
    const video = await new Exporter(({ completed, total }) => { document.getElementById('state').textContent = `MP4: ${completed}/${total}`; }).run('mp4', brief, 0);
    const element = document.getElementById('video');
    await new Promise((resolve, reject) => { element.onloadeddata = resolve; element.onerror = () => reject(new Error('MP4 decode failed')); element.src = URL.createObjectURL(video.blob); });
    assert(element.videoWidth === WIDTH && element.videoHeight === HEIGHT, 'Video dimensions');
    assert(Math.abs(element.duration - expected.duration) < .04, 'Video duration');
    await new Promise(resolve => { element.onseeked = resolve; element.currentTime = expected.duration / 3; });
    const decoded = new OffscreenCanvas(WIDTH, HEIGHT), ctx = decoded.getContext('2d'); ctx.drawImage(element, 0, 0);
    const videoPixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
    let blue = 0; for (let i = 0; i < videoPixels.length; i += 4) if (videoPixels[i + 2] > 80 && videoPixels[i + 2] > videoPixels[i] * 1.5 && videoPixels[i + 2] > videoPixels[i + 1]) blue++;
    assert(blue > 10, 'Decoded video has no blue text');
    record('Full H.264 MP4 decodes and seeks with visible text, correct size and duration', `1920×1080 / 30 fps / ${element.duration.toFixed(3)} s / ${video.blob.size} bytes`); link(video.blob, 'erik-test.mp4');
    document.getElementById('state').textContent = 'All checks passed';
} catch (error) { document.getElementById('state').textContent = `FAIL: ${error.message}`; reports.push({ status: 'failed', message: error.stack }); }
finally { renderer?.destroy(); document.getElementById('report').textContent = JSON.stringify({ date: '2026-10-15', checks: reports }, null, 2); }
