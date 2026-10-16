import { CrawlRenderer, loadFont } from '../renderer.js?v=2';
import { normalize } from '../model.js';
import { Exporter } from '../exporter.js?v=2';
const reports = [], assert = (value, message) => { if (!value) throw new Error(message); };
const record = name => { reports.push(name); const li = document.createElement('li'); li.textContent = 'PASS · ' + name; document.getElementById('results').append(li); };
const pixels = async blob => { const image = await createImageBitmap(blob), canvas = new OffscreenCanvas(1920, 1080), ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close(); return ctx.getImageData(0, 0, 1920, 1080).data; };
const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
let renderer;
try {
    await loadFont();
    const plain = new FontFace('Erik Plain Reference', 'url("../../infra/framework/fonts/LunnenDisplay-VariableVF.woff2")', { weight: '100 400', featureSettings: '"dlig" 0' });
    await plain.load(); document.fonts.add(plain);
    const ctx = new OffscreenCanvas(1920, 1080).getContext('2d');
    for (const weight of [100, 250, 400]) for (const tracking of [-2, 0, 2, 8]) for (const text of ['NN', 'Lunnen', 'LUNNEN', 'lunnen']) {
        ctx.letterSpacing = `${tracking}px`;
        ctx.font = `${weight} 100px "Erik Lunnen"`; const shaped = ctx.measureText(text).width;
        ctx.font = `${weight} 100px "Erik Plain Reference"`; const unjoined = ctx.measureText(text).width;
        assert(shaped < unjoined - 1, `${text} ligature missing: weight ${weight}, tracking ${tracking}`);
    }
    record('NN and Lunnen case variants join at all sampled weights and tracking values (48 combinations)');
    for (const [stage, content, time] of [
        ['logo', { title: 'Lunnen\nAiris', body: '' }, 2],
        ['crawl', { title: '', body: '-Lunnen team-\nbrand | LUNNEN\nlunnen studio' }, 3],
        ['ending', { title: '', body: '', endingType: 'text', endingText: 'Lunnen\nAiris', endingDuration: 3 }, 1]
    ]) {
        const settings = normalize({ ...content, tracking: 2 });
        renderer = new CrawlRenderer(); await renderer.loadEnding(settings);
        const output = renderer.render(settings, time, { transparent: true });
        const preview = await pixels(await output.convertToBlob());
        assert(preview.some((n, i) => i % 4 === 3 && n > 0), stage + ' is blank');
        const exported = await new Exporter().run('frame', settings, time);
        assert(equal(preview, await pixels(exported.blob)), stage + ' worker PNG differs from preview');
        if (stage === 'logo') document.getElementById('preview').getContext('2d').drawImage(output, 0, 0);
        renderer.destroy(); renderer = null;
        // A zero-width non-joiner breaks NN shaping without changing visible letters.
        const unjoined = { ...settings };
        for (const key of ['title', 'body', 'endingText']) unjoined[key] = settings[key].replace(/(lun)(nen)/gi, '$1\u200c$2');
        renderer = new CrawlRenderer(); await renderer.loadEnding(settings);
        const withoutLigatures = await pixels(await renderer.render(unjoined, time, { transparent: true }).convertToBlob());
        assert(!equal(preview, withoutLigatures), stage + ' did not apply ligatures');
        renderer.destroy(); renderer = null;
        record(stage + ': joined glyphs visible and transparent worker PNG equals preview pixel-for-pixel');
    }
    document.getElementById('state').textContent = 'All ligature checks passed';
} catch (error) { document.getElementById('state').textContent = 'FAIL: ' + error.message; reports.push(error.stack); }
finally { renderer?.destroy(); document.getElementById('report').textContent = JSON.stringify(reports, null, 2); }
