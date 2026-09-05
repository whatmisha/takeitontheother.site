/**
 * Replaces one document-level controller together with the MutationObserver
 * that keeps it synchronized with late-injected UI fragments.
 *
 * Auto-init modules can be evaluated more than once by development reloaders.
 * Keeping the observer and controller in one disposable value prevents every
 * evaluation from leaving another observer and keydown listener behind.
 */
export function replaceObservedController({
    scope = globalThis,
    key,
    createController,
    installObserver
} = {}) {
    if (key == null) throw new TypeError('Observed controller key is required.');
    if (typeof createController !== 'function') {
        throw new TypeError('Observed controller factory is required.');
    }
    if (typeof installObserver !== 'function') {
        throw new TypeError('Observed controller installer is required.');
    }

    scope[key]?.destroy?.();

    const controller = createController();
    const observer = installObserver(controller);
    let destroyed = false;
    const lifecycle = {
        controller,
        observer,
        sync: (...args) => controller.sync?.(...args),
        destroy() {
            if (destroyed) return false;
            destroyed = true;
            observer.disconnect?.();
            controller.destroy?.();
            if (scope[key] === lifecycle) delete scope[key];
            return true;
        }
    };
    scope[key] = lifecycle;
    return lifecycle;
}

/**
 * Observes the current document root without letting an iframe navigation race
 * surface as an uncaught cross-realm Node error. A failed first attachment is
 * retried once after the new document has settled.
 */
export function installDocumentObserver(controller, {
    ownerDocument = globalThis.document,
    options = { childList: true, subtree: true }
} = {}) {
    const view = ownerDocument?.defaultView;
    const Observer = view?.MutationObserver;
    if (typeof Observer !== 'function') {
        return { disconnect() {} };
    }

    const observer = new Observer(() => controller.sync?.());
    let connected = false;
    let retryTimer = null;
    const connect = () => {
        if (connected) return true;
        try {
            const root = ownerDocument.documentElement;
            if (!root) return false;
            observer.observe(root, options);
            connected = true;
            return true;
        } catch {
            return false;
        }
    };

    if (!connect()) {
        retryTimer = view.setTimeout(() => {
            retryTimer = null;
            connect();
        }, 0);
    }

    return {
        disconnect() {
            if (retryTimer != null) view.clearTimeout(retryTimer);
            retryTimer = null;
            observer.disconnect();
            connected = false;
        }
    };
}
