import createElement from './vendor/lucide/createElement.js';
import ArrowLeft from './vendor/lucide/icons/arrow-left.js';
import ChevronDown from './vendor/lucide/icons/chevron-down.js';
import Undo from './vendor/lucide/icons/undo-2.js';
import Redo from './vendor/lucide/icons/redo-2.js';
import Pin from './vendor/lucide/icons/pin.js';
import PinOff from './vendor/lucide/icons/pin-off.js';
import Rotate from './vendor/lucide/icons/rotate-cw.js';
import Scaling from './vendor/lucide/icons/scaling.js';
import Shuffle from './vendor/lucide/icons/shuffle.js';
import Refresh from './vendor/lucide/icons/refresh-cw.js';
import Plus from './vendor/lucide/icons/plus.js';
import Minus from './vendor/lucide/icons/minus.js';
import Trash from './vendor/lucide/icons/trash-2.js';
import Up from './vendor/lucide/icons/arrow-up.js';
import Down from './vendor/lucide/icons/arrow-down.js';
import Maximize from './vendor/lucide/icons/maximize.js';
import Link from './vendor/lucide/icons/link.js';
import Save from './vendor/lucide/icons/save.js';
import Select from './vendor/lucide/icons/mouse-pointer-2.js';
import Grip from './vendor/lucide/icons/grip-vertical.js';

const icons = { back: ArrowLeft, chevron: ChevronDown, undo: Undo, redo: Redo, pin: Pin, unpin: PinOff, rotate: Rotate,
    scale: Scaling, shuffle: Shuffle, refresh: Refresh, plus: Plus, minus: Minus, trash: Trash, up: Up, down: Down, fit: Maximize, link: Link, save: Save, select: Select, grip: Grip };
export function icon(name, size = 18) { return createElement(icons[name], { width: size, height: size, 'aria-hidden': 'true', 'stroke-width': 1.6 }); }
export function mountIcons() { document.querySelectorAll('[data-icon]').forEach(node => node.replaceChildren(icon(node.dataset.icon))); }
