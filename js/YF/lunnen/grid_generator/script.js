import { GridGenerator } from './GridGenerator.js?v=1.12.66';

async function loadApplicationFonts() {
    await Promise.all([
        document.fonts.load('500 16px "TT Commons Classic"'),
        document.fonts.load('400 16px "TT Commons Classic"'),
        document.fonts.ready
    ]);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadApplicationFonts();
    } catch (error) {
        console.warn('Font loading warning:', error);
    }

    try {
        const application = new GridGenerator();
        await application.startupController.initialize();
    } catch (error) {
        document.documentElement.dataset.appReady = 'error';
        console.error('Application initialization failed:', error);
    }
});
