// Oak and Raven — WebGL effects entry point.
// Everything bails on reduced-motion or missing WebGL; the page is fully
// designed to stand on its own without any of these layers.

import { REDUCED_MOTION, supportsWebGL } from './utils.js';
import { initMurmuration } from './murmuration.js';
import { initMotes } from './motes.js';
import { initIridescence } from './iridescence.js';

if (!REDUCED_MOTION && supportsWebGL()) {
  const murmuration = document.getElementById('fx-murmuration');
  if (murmuration) initMurmuration(murmuration);

  document.querySelectorAll('canvas[data-motes]').forEach(initMotes);

  const iridescence = document.getElementById('fx-iridescence');
  if (iridescence) initIridescence(iridescence);
}
