/** Print the JS port block(s) for the given item ids: node scripts/_show-port.mjs id [id…] */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'js/pages/sim/engine/scripts';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(DIR);

for (const id of process.argv.slice(2)) {
  let found = false;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (!new RegExp(`handlerId:\\s*'${id}'`).test(lines[i])) continue;
      let start = i;
      while (start > 0 && !/^(?:export )?const\s+\w+\s*=\s*\{/.test(lines[start])) start--;
      let end = i;
      while (end < lines.length - 1 && !/^\};?$/.test(lines[end])) end++;
      console.log(`\n===== ${id} — ${file.replace(/\\/g, '/')}:${start + 1}`);
      console.log(lines.slice(Math.max(0, start - 3), end + 1).join('\n'));
      found = true;
    }
  }
  if (!found) console.log(`\n===== ${id} — no handlerId block found`);
}
