// Tiny event helper so game panels can drive the 3D arena without importing three.js.
export const show = (detail) => { try { window.dispatchEvent(new CustomEvent('passbch:show', { detail })); } catch { /* no window (tests) */ } };
