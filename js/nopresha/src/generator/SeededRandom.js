export class SeededRandom {
    constructor(seed = 'seed') {
        this.seed = String(seed || 'seed');
        this.state = this.hash(this.seed);
    }

    hash(value) {
        let h = 2166136261;
        for (let i = 0; i < value.length; i += 1) {
            h ^= value.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    next() {
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
        return min + (max - min) * this.next();
    }

    int(min, max) {
        return Math.floor(this.range(min, max + 1));
    }

    chance(probability) {
        return this.next() < probability;
    }

    choice(items) {
        return items[Math.floor(this.next() * items.length)];
    }

    gaussian(mean = 0, deviation = 1) {
        let u = 0;
        let v = 0;
        while (u === 0) u = this.next();
        while (v === 0) v = this.next();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
        return mean + z * deviation;
    }
}
