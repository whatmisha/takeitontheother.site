const button = document.getElementById('navigate');
const frames = [...document.querySelectorAll('iframe')];
let visits = 0;
document.getElementById('layout').addEventListener('change', event => {
    document.body.dataset.layout = event.target.value;
});
button.addEventListener('click', async () => {
    button.disabled = true;
    try {
        await Promise.all(frames.map((frame, index) => new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { frame.onload = null; reject(new Error('Frame load timed out')); }, 10000);
            frame.onload = () => { clearTimeout(timeout); frame.onload = null; resolve(); };
            frame.src = `observer-empty.html?ui-audit=${Date.now()}-${visits}-${index}`;
        })));
        visits++;
        document.getElementById('state').textContent = `Completed ${visits} reloads`;
        const samples = [window, ...frames.map(frame => frame.contentWindow)].map(view => view.__upgradeRuntimeProbe.snapshot());
        document.getElementById('errors').textContent = JSON.stringify(samples, null, 2);
    } catch (error) {
        document.getElementById('state').textContent = error.message;
    } finally {
        button.disabled = false;
    }
});
