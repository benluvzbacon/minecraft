// Node ESM loader hook: redirect `import ... from 'three'` to our stub,
// which re-exports the real three but replaces WebGLRenderer (no GL in Node).
export async function resolve(specifier, context, next) {
  if (specifier === 'three') {
    return {
      url: new URL('./three-stub.mjs', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
