// Phones and tablets: a coarse primary pointer with no hover. Evaluated once.
const mq = (q) => typeof matchMedia === 'function' && matchMedia(q).matches
export const isTouch = mq('(pointer: coarse)') && !mq('(hover: hover) and (pointer: fine)')
