import { ExportFeedbackController } from '../src/index.js?v=uiq-2';

const button = document.getElementById('labFeedbackButton');
const status = document.getElementById('labFeedbackStatus');
const feedback = new ExportFeedbackController({ button, status });
document.getElementById('labFeedbackUnavailable').addEventListener('change', event => {
    button.disabled = event.target.checked;
});
button.addEventListener('click', () => {
    const fail = document.getElementById('labFeedbackFail').checked;
    void feedback.run(() => new Promise((resolve, reject) => {
        setTimeout(() => {
            if (fail) reject(new Error('Simulated encoder failure'));
            else resolve({ demo: true });
        }, 750);
    }));
});
window.addEventListener('pagehide', () => feedback.destroy(), { once: true });
