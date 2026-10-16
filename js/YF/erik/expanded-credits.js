import { normalize, creditsToText } from './model.js';
export const FULL_CREDITS_NAME = 'Lunnen Airis — Full Credits';
export const FULL_CREDITS = Object.freeze([
    { kind: 'heading', role: 'Lunnen team', name: '' },
    { role: 'art director', name: '@enhanser' },
    { role: 'graphic designer', name: '@whatmisha' },
    { role: 'product manager', name: 'Sergey Kharchenko' },
    { role: 'head of product', name: '@neverunderestimatethelittleguy' },
    { role: 'product manager', name: '@smirlira' },
    { role: 'creative producer', name: '@natahandreeva' },
    { kind: 'heading', role: 'Photo production team', name: '' },
    { role: 'content production head', name: '@zatais' },
    { role: 'assistant producer', name: '@kvolozina' },
    { role: 'photographer', name: '@rosstovtseva' },
    { role: 'retouch', name: '@berezhneva.production' },
    { role: 'set designer', name: '@sakhar_d' },
    { role: 'assistant set designer', name: '@nedoabortesh' },
    { role: 'muah', name: '@soya.mua' },
    { role: 'stylist', name: '@svetamiha' },
    { role: 'assistant stylist', name: '@bazaarovvv' },
    { role: 'dop backstage', name: '@yasha__yakovlev' },
    { role: 'models', name: '@motionmngt' }
].map(Object.freeze));
export function expandedCredits(settings) {
    const { contentMode, credits, ...current } = settings;
    return normalize({ ...current, body: creditsToText(FULL_CREDITS) });
}
