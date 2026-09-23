import { calendarElements, createCalendarScene } from '../../../../calendar-randomizer/scene.js?v=2';
const area = document.getElementById('artwork'), output = document.getElementById('results');
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const nested = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 320">
<defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient><clipPath id="clip"><rect width="80" height="80"/></clipPath><mask id="mask"><rect width="100" height="100" fill="white"/></mask><g id="symbol"><path d="M0 0L10 10" fill="none" stroke="black"/></g></defs>
<style>.solid{fill:#12345678;stroke:none}.gradient{fill:url(#paint)}.base-css{transform:translate(4px,7px) rotate(5deg)}</style>
<g id="outer" transform="translate(30,40) rotate(12)"><g id="inner" transform="scale(2)"><rect id="leaf" width="20" height="30" fill="none" stroke="red" style="opacity:.4;fill:none;stroke:red"/></g></g>
<rect id="gradient" class="gradient" x="120" width="100" height="100" clip-path="url(#clip)"/>
<rect id="solid" class="solid" x="230" width="30" height="40"/>
<rect id="css" class="base-css" x="280" width="30" height="40"/>
<use href="#symbol" x="350"/><title>Untouched metadata</title></svg>`;
const matrix = element => { const m = element.getCTM(); return [m.a,m.b,m.c,m.d,m.e,m.f]; };
const equal = (actual, expected, label) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); };
const near = (actual, expected, label) => { actual.forEach((value, i) => { if (Math.abs(value - expected[i]) > .0001) throw new Error(`${label}: matrix changed`); }); };
const require = (condition, label) => { if (!condition) throw new Error(label); };
document.getElementById('run').addEventListener('click', async event => {
    event.target.disabled = true; output.textContent = 'Running'; const results = [];
    try {
        for (const name of ['nested', 'calend_01', 'calend_02', 'calend_03', 'calend_04']) {
            area.innerHTML = name === 'nested' ? nested : await (await fetch(`../../../../calendar-randomizer/source/${name}.svg`)).text();
            const svg = area.querySelector('svg'); await frame();
            const targets = calendarElements(svg), before = targets.map(matrix);
            const resources = [...svg.querySelectorAll('defs > :not(style)')].map(node => node.outerHTML);
            const scene = createCalendarScene(svg, { random: () => .75 });
            scene.recolor('#abcdef'); scene.randomize({ range: 10, speed: 0 }); await frame();
            require(targets.some((element, i) => JSON.stringify(matrix(element)) !== JSON.stringify(before[i])), 'Randomize must move artwork');
            scene.reset({ speed: 0 }); await frame();
            targets.forEach((element,i) => near(matrix(element), before[i], `${name}: Reset`));
            scene.randomize({ range: 20, speed: 4 });
            const liveBeforeExport = svg.outerHTML;
            const clone = scene.exportClone({ range: 10 });
            equal(svg.outerHTML, liveBeforeExport, 'Export may not mutate live frame');
            equal([...clone.querySelectorAll('defs > :not(style)')].map(node => node.outerHTML), resources, 'Definition resources');
            const xml = new XMLSerializer().serializeToString(clone);
            require(!/NaN|Infinity/.test(xml), 'Finite SVG');
            const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
            require(!parsed.querySelector('parsererror'), 'Round-trip valid SVG');
            require(calendarElements(clone).every(node => !node.style.transition && node.style.transform.startsWith('translate(5px, 5px)')), 'Fresh deterministic export offsets during transition');
            if (name === 'nested') {
                equal(clone.querySelector('#leaf').style.fill, 'none', 'Inline none');
                equal(clone.querySelector('#leaf').style.opacity, '0.4', 'Inline opacity');
                require(['#abcdef', 'rgb(171, 205, 239)'].includes(clone.querySelector('#leaf').style.stroke), 'Inline stroke');
                require(clone.querySelector('style').textContent.includes('fill:url(#paint)'), 'Gradient reference');
                require(clone.querySelector('style').textContent.includes('fill: #abcdef78'), 'Paint alpha');
                require(clone.querySelector('#outer').style.transform.includes('matrix('), 'Base attribute transform');
                require(clone.querySelector('#css').style.transform.includes('matrix('), 'Base CSS transform');
                require(!clone.querySelector('title').hasAttribute('transform'), 'Metadata excluded');
            }
            results.push({ fixture: name, passed: true, animatedElements: targets.length, svgBytes: new TextEncoder().encode(xml).length });
        }
        output.dataset.result = 'passed'; output.textContent = JSON.stringify({ passed: results.length, results }, null, 2);
    } catch (error) { output.dataset.result = 'failed'; output.textContent = JSON.stringify({ results, error: error.message }, null, 2); }
    finally { event.target.disabled = false; }
});
