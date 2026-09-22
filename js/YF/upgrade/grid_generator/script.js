import { GridGenerator } from './src/core/GridGenerator.js';
import { loadApplicationShell } from './src/ui/ApplicationShellLoader.js';

const APPLICATION_INSTANCE = Symbol.for('lunnen.grid-generator.application');

async function loadApplicationFonts() {
    await Promise.all([
        document.fonts.load('500 16px "TT Commons Classic"'),
        document.fonts.load('400 16px "TT Commons Classic"'),
        document.fonts.ready
    ]);
}

async function startApplication() {
    let application = null;
    try {
        await loadApplicationShell();
        try {
            await loadApplicationFonts();
        } catch (error) {
            console.warn('Font loading warning:', error);
        }

        globalThis[APPLICATION_INSTANCE]?.dispose?.();
        application = new GridGenerator();
        globalThis[APPLICATION_INSTANCE] = application;
        await application.startupController.initialize();
    } catch (error) {
        application?.dispose?.();
        if (globalThis[APPLICATION_INSTANCE] === application) {
            delete globalThis[APPLICATION_INSTANCE];
        }
        document.documentElement.dataset.appReady = 'error';
        document.documentElement.dataset.appError = error?.message || String(error);
        console.error('Application initialization failed:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication, { once: true });
} else {
    void startApplication();
}
