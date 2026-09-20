import { DEFAULT_RENDER_DISTANCE } from './config.js';
import { loadSettings, saveSettings } from './save.js';

export const defaultSettings = {
  sensitivity: 0.0022,
  renderDistance: DEFAULT_RENDER_DISTANCE,
  fov: 75,
  quality: 'medium',
  volume: 0.6,
  invertY: false,
  shadows: false,
};

export function getSettings() {
  return { ...defaultSettings, ...loadSettings() };
}

export function setSettings(partial) {
  const next = { ...getSettings(), ...partial };
  saveSettings(next);
  return next;
}
