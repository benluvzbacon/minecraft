// Re-export the real three.js module (resolved by path so the loader hook
// doesn't redirect it back here), but replace WebGLRenderer with a no-op fake
// so the game can boot headlessly in Node.
export * from '../node_modules/three/build/three.module.js';

export class WebGLRenderer {
  constructor(opts = {}) {
    this.domElement = opts.canvas || { width: 0, height: 0 };
    this.shadowMap = { enabled: false, type: 0 };
    this.outputColorSpace = '';
    this.info = { render: {}, memory: {} };
    this.pixelRatio = 1;
  }
  setPixelRatio(r) { this.pixelRatio = r; }
  setSize() {}
  getSize(v) { return v ? v.set(1280, 720) : { width: 1280, height: 720 }; }
  getPixelRatio() { return 1; }
  render() {}
  dispose() {}
  forceContextLoss() {}
}
