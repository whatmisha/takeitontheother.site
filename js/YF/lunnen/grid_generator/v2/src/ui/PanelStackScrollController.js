import { ListenerScope } from '../core/ListenerScope.js';
import { classifyPanelVisibility, getPanelHeaderLabel, getScrollTopForTarget, clampScrollTop } from './PanelStackScroll.js';

export class PanelStackScrollController {
    constructor(documentRef = document, windowRef = window) {
        this.document = documentRef;
        this.window = windowRef;
        this.listeners = new ListenerScope();
        this.stacks = new Map();
        this.pendingFrame = null;
        this.bound = false;
    }

    bind() {
        if (this.bound) return false;
        this.bound = true;

        this.document.querySelectorAll('.controls-panel-stack').forEach(stack => {
            this.prepareStack(stack);
        });

        this.scheduleUpdate();
        this.listeners.listen(this.window, 'resize', () => this.scheduleUpdate());
        return true;
    }

    prepareStack(stack) {
        if (stack.dataset.stackScrollReady === 'true') {
            return this.stacks.get(stack.id)?.scrollBody || null;
        }

        const panels = [...stack.querySelectorAll(':scope > .controls-panel')];
        if (!panels.length) return null;

        const top = this.document.createElement('div');
        top.className = 'panel-stack-offscreen panel-stack-offscreen--top';
        top.setAttribute('aria-live', 'polite');

        const scrollBody = this.document.createElement('div');
        scrollBody.className = 'panel-stack-scroll-body';

        const bottom = this.document.createElement('div');
        bottom.className = 'panel-stack-offscreen panel-stack-offscreen--bottom';
        bottom.setAttribute('aria-live', 'polite');

        stack.insertBefore(top, panels[0]);
        panels.forEach(panel => scrollBody.appendChild(panel));
        stack.appendChild(scrollBody);
        stack.appendChild(bottom);

        const state = { stack, scrollBody, top, bottom, observers: [] };
        this.stacks.set(stack.id, state);

        this.listeners.listen(scrollBody, 'scroll', () => this.scheduleUpdate(), { passive: true });

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => this.scheduleUpdate());
            observer.observe(scrollBody);
            panels.forEach(panel => observer.observe(panel));
            state.observers.push(observer);
        }

        stack.dataset.stackScrollReady = 'true';
        return scrollBody;
    }

    scheduleUpdate() {
        if (this.pendingFrame != null) return;
        this.pendingFrame = this.window.requestAnimationFrame(() => {
            this.pendingFrame = null;
            this.updateAll();
        });
    }

    updateAll() {
        this.stacks.forEach(state => this.updateStack(state));
    }

    updateStack({ stack, scrollBody, top, bottom }) {
        if (!scrollBody.isConnected) return;

        top.replaceChildren();
        bottom.replaceChildren();

        const scrollRect = scrollBody.getBoundingClientRect();
        const panels = [...scrollBody.querySelectorAll(':scope > .controls-panel')];

        panels.forEach(panel => {
            const visibility = classifyPanelVisibility(panel.getBoundingClientRect(), scrollRect);
            if (visibility === 'visible') return;

            const chip = this.createChip(panel, scrollBody);
            if (visibility === 'above') top.appendChild(chip);
            else bottom.appendChild(chip);
        });

        stack.classList.toggle('panel-stack-has-offscreen-top', top.childElementCount > 0);
        stack.classList.toggle('panel-stack-has-offscreen-bottom', bottom.childElementCount > 0);
    }

    createChip(panel, scrollBody) {
        const header = panel.querySelector('.panel-header');
        const label = getPanelHeaderLabel(header);
        const chip = this.document.createElement('button');
        chip.type = 'button';
        chip.className = 'panel-stack-offscreen-chip';
        chip.dataset.panelId = panel.id;
        chip.setAttribute(
            'aria-label',
            header?.querySelector('span:first-child')?.textContent?.trim() || panel.id
        );
        chip.innerHTML = `<div class="panel-header panel-stack-offscreen-chip-header"><span>${label}</span></div>`;

        chip.addEventListener('click', () => {
            this.scrollPanelIntoView(scrollBody, panel);
        });

        return chip;
    }

    scrollPanelIntoView(scrollBody, panel) {
        const header = panel.querySelector('.panel-header') || panel;
        const targetTop = clampScrollTop(scrollBody, getScrollTopForTarget(scrollBody, header));

        scrollBody.scrollTo({ top: targetTop, behavior: 'smooth' });

        const snap = () => {
            const correctedTop = clampScrollTop(
                scrollBody,
                getScrollTopForTarget(scrollBody, header)
            );
            if (Math.abs(scrollBody.scrollTop - correctedTop) > 1) {
                scrollBody.scrollTop = correctedTop;
            }
            this.scheduleUpdate();
        };

        if (typeof scrollBody.onscrollend !== 'undefined') {
            scrollBody.addEventListener('scrollend', snap, { once: true });
        } else {
            this.window.setTimeout(snap, 350);
        }
    }

    dispose() {
        if (this.pendingFrame != null) {
            this.window.cancelAnimationFrame(this.pendingFrame);
            this.pendingFrame = null;
        }
        this.stacks.forEach(state => {
            state.observers.forEach(observer => observer.disconnect());
        });
        this.stacks.clear();
        this.bound = false;
        return this.listeners.dispose();
    }
}
