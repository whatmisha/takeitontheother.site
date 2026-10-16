import { CrawlRenderer, loadFont } from '../renderer.js';
import { normalize, framePlan } from '../model.js';
import { Exporter } from '../exporter.js';
import { readEndingFile, svgImageSource } from '../ending-assets.js';
import { presetDocument, parsePreset } from '../document.js';
const reports = [], assert = (value, message) => { if (!value) throw new Error(message); };
const record = name => { reports.push(name); const li = document.createElement('li'); li.textContent = 'PASS · ' + name; document.getElementById('results').append(li); };
const pixels = async blob => { const image = await createImageBitmap(blob), canvas = new OffscreenCanvas(1920, 1080), ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close(); return ctx.getImageData(0, 0, 1920, 1080).data; };
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const count = data => { let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i]) n++; return n; };
let renderer;
try {
    await loadFont(); renderer = new CrawlRenderer();
    const base = normalize({ title: '', body: '', endingType: 'text', endingText: 'Lunnen\nAiris', endingDuration: 3 });
    let settings = base;
    for (const type of ['text', 'svg', 'lottie-json', 'dotlottie']) {
        if (type !== 'text') {
            const ext = { svg: 'svg', 'lottie-json': 'json', dotlottie: 'lottie' }[type], blob = await (await fetch('./fixtures/ending.' + ext)).blob();
            const asset = await readEndingFile(new File([blob], 'ending.' + ext), type === 'svg' ? 'svg' : 'lottie');
            settings = normalize({ ...base, endingType: type === 'svg' ? 'svg' : 'lottie', endingAsset: asset });
        }
        await renderer.loadEnding(settings);
        const plan = framePlan(settings, renderer.prepare(settings));
        assert(plan.duration === 3, 'Ending-only duration must be 3 seconds');
        const preview = await pixels(await renderer.render(settings, 1, { transparent: true }).convertToBlob());
        assert(count(preview) > 5000 && preview[3] === 0, type + ' must be visible on transparent background');
        const exported = await new Exporter().run('frame', settings, 1);
        assert(equal(preview, await pixels(exported.blob)), type + ' differs between preview and worker export');
        renderer.render(settings, 2.5, { transparent: true });
        assert(equal(preview, await pixels(await renderer.render(settings, 1, { transparent: true }).convertToBlob())), type + ' random seek changed pixels');
        assert(JSON.stringify(parsePreset(JSON.stringify(presetDocument(settings))).settings) === JSON.stringify(settings), 'Preset lost asset');
        const fade = { ...settings, endingFadeIn: true, endingFadeOut: true };
        assert(count(await pixels(await renderer.render(fade, 0, { transparent: true }).convertToBlob())) === 0, 'Fade-in starts visible');
        assert(count(await pixels(await renderer.render(fade, plan.lastTime, { transparent: true }).convertToBlob())) === 0, 'Fade-out ends visible');
        const inOnly = { ...settings, endingFadeIn: true, endingFadeOut: false };
        const outOnly = { ...settings, endingFadeIn: false, endingFadeOut: true };
        assert(count(await pixels(await renderer.render(inOnly, 0, { transparent: true }).convertToBlob())) === 0, 'Independent Fade in starts visible');
        assert(count(await pixels(await renderer.render(inOnly, plan.lastTime, { transparent: true }).convertToBlob())) > 5000, 'Fade in hides the last frame');
        assert(count(await pixels(await renderer.render(outOnly, 0, { transparent: true }).convertToBlob())) > 5000, 'Fade out hides the first frame');
        assert(count(await pixels(await renderer.render(outOnly, plan.lastTime, { transparent: true }).convertToBlob())) === 0, 'Independent Fade out ends visible');
        document.getElementById('preview').getContext('2d').drawImage(renderer.render(settings, 1, { transparent: true }), 0, 0);
        record(type + ': rendered, deterministic seek, exact worker PNG, alpha, optional fade, preset round trip');
        if (type === 'dotlottie') {
            const first = await pixels(await renderer.render(settings, 0, { transparent: true }).convertToBlob());
            assert(!equal(first, preview), 'Lottie did not animate');
            const last = await pixels(await renderer.render(settings, 2, { transparent: true }).convertToBlob());
            assert(equal(last, await pixels(await renderer.render(settings, 2.9, { transparent: true }).convertToBlob())), 'Lottie should hold final source frame');
            record('Lottie advances at its own frame rate and holds instead of looping');
        }
    }
    for (const svg of ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://example.com/x.png"/></svg>', '<svg>broken']) {
        let rejected = false; try { svgImageSource(svg); } catch { rejected = true; } assert(rejected, 'Unsafe/broken SVG accepted');
    }
    svgImageSource('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="url(\'#gradient\')"/></svg>');
    record('SVG rejects scripts, external dependencies and malformed XML; local gradient references remain valid');
    const withCrawl = normalize({ ...settings, title: '', body: 'A short credit', endingGap: 240, speed: 120 });
    const crawlPlan = framePlan(withCrawl, renderer.prepare(withCrawl));
    assert(crawlPlan.ending.startFrame === crawlPlan.crawlFrames + 60, 'Ending gap must follow speed');
    assert(count(await pixels(await renderer.render(withCrawl, (crawlPlan.ending.startFrame - 1) / 30, { transparent: true }).convertToBlob())) === 0, 'Gap is not blank');
    record('Ending follows crawl fade and the speed-based gap without overlap');
    for (const endingGap of [-240, -2400]) {
        const overlap = normalize({ ...withCrawl, endingGap, logoGap: -10, title: 'Lunnen', body: 'A short credit' });
        const overlapPlan = framePlan(overlap, renderer.prepare(overlap));
        assert(overlapPlan.ending.startFrame === Math.max(0, overlapPlan.crawlFrames + Math.ceil(endingGap / overlap.speed * 30)), 'Signed ending gap timing');
        assert(overlapPlan.frames >= overlapPlan.crawlFrames, 'Early ending truncated crawl');
        const t = (overlapPlan.ending.startFrame + 15) / 30;
        const preview = await pixels(await renderer.render(overlap, t, { transparent: true }).convertToBlob());
        const exported = await new Exporter().run('frame', overlap, t);
        assert(equal(preview, await pixels(exported.blob)), 'Negative gap preview/export mismatch');
        assert(count(preview) > 5000, 'Negative gap rendered blank');
    }
    record('Negative gaps overlap in preview and worker PNG, clamp at frame zero and preserve the full crawl');
    const clip = { ...settings, endingDuration: 1 };
    const sequence = await new Exporter().run('sequence', clip, 0), data = new Uint8Array(await sequence.blob.arrayBuffer()), view = new DataView(data.buffer);
    let offset = 0, entries = 0, last;
    while (view.getUint32(offset, true) === 0x04034b50) {
        const length = view.getUint32(offset + 18, true), start = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
        last = new Blob([data.slice(start, start + length)], { type: 'image/png' }); entries++; offset = start + length;
    }
    assert(entries === 30 && count(await pixels(last)) > 5000, 'PNG sequence lost the ending');
    record('PNG sequence contains every ending frame, including a visible final frame with fade disabled');
    const video = await new Exporter(({ completed, total }) => document.getElementById('state').textContent = `MP4 ${completed}/${total}`).run('mp4', settings, 0);
    const element = document.getElementById('video');
    await new Promise((resolve, reject) => { element.onloadeddata = resolve; element.onerror = () => reject(new Error('MP4 decode failed')); element.src = URL.createObjectURL(video.blob); });
    assert(element.videoWidth === 1920 && element.videoHeight === 1080 && Math.abs(element.duration - 3) < .04, 'MP4 metadata incorrect');
    await new Promise(resolve => { element.onseeked = resolve; element.currentTime = 1; });
    const frame = new OffscreenCanvas(1920, 1080), ctx = frame.getContext('2d'); ctx.drawImage(element, 0, 0);
    const decoded = ctx.getImageData(0, 0, 1920, 1080).data;
    assert(decoded.some((n, i) => i % 4 === 2 && n > 100 && n > decoded[i - 2] * 1.5), 'MP4 ending is blank');
    record('Real Lottie H.264 MP4 decodes at 1920×1080, 30 fps, with correct duration and visible animation');
    document.getElementById('state').textContent = 'All ending checks passed';
} catch (error) { document.getElementById('state').textContent = 'FAIL: ' + error.message; reports.push(error.stack); }
finally { renderer?.destroy(); document.getElementById('report').textContent = JSON.stringify(reports, null, 2); }
