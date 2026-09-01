/**
 * Dev sandbox — create right-rail Filters | Build tabs (game Itemiary chrome).
 * Not wired into /create/ yet.
 */

import { mountCreateRail } from './rail.js';

const host = document.getElementById('create-rail-host');
if (host) mountCreateRail(host);
