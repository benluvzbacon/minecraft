// Registers the three->stub loader hook. Used via: node --import ./tests/register.mjs
import { register } from 'node:module';
register('./hooks.mjs', import.meta.url);
