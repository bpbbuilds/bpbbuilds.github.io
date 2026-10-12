import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function firstExisting(paths) {
  return paths.find((candidate) => candidate && existsSync(candidate)) || null;
}

function installedChromePath() {
  const env = process.env;
  const candidates = [
    env.CHROME_DEVTOOLS_MCP_EXECUTABLE,
    env.PROGRAMFILES && join(env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env['PROGRAMFILES(X86)'] && join(env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
    env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  const installed = firstExisting(candidates);
  if (installed) return installed;

  const browsersRoot =
    env.PLAYWRIGHT_BROWSERS_PATH ||
    (env.LOCALAPPDATA && join(env.LOCALAPPDATA, 'ms-playwright'));
  if (!browsersRoot || !existsSync(browsersRoot)) return null;

  const chromiumFolders = readdirSync(browsersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^chromium-\d+$/.test(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }));

  for (const folder of chromiumFolders) {
    const candidate = firstExisting([
      join(browsersRoot, folder.name, 'chrome-win64', 'chrome.exe'),
      join(browsersRoot, folder.name, 'chrome-win', 'chrome.exe'),
    ]);
    if (candidate) return candidate;
  }

  return null;
}

const executablePath = installedChromePath();
const args = [
  '--yes',
  'chrome-devtools-mcp@latest',
  '--isolated',
  '--no-usage-statistics',
  '--no-performance-crux',
  '--redact-network-headers',
];

if (process.env.CHROME_DEVTOOLS_MCP_HEADLESS === '1') args.push('--headless');
if (executablePath) args.push('--executablePath', executablePath);
args.push(...process.argv.slice(2));

console.error(
  executablePath
    ? `chrome-devtools-mcp browser: ${executablePath}`
    : 'chrome-devtools-mcp browser: letting the server locate installed Chrome',
);

const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npx';
const commandLineArg = (value) => {
  const text = String(value);
  return /[\s"&|<>^]/.test(text)
    ? `"${text.replaceAll('"', '\\"')}"`
    : text;
};
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx ${args.map(commandLineArg).join(' ')}`]
  : args;

const child = spawn(command, commandArgs, {
  env: {
    ...process.env,
    CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1',
    CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: '1',
  },
  stdio: 'inherit',
  windowsHide: true,
});

child.on('error', (error) => {
  console.error(`Unable to start chrome-devtools-mcp: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`chrome-devtools-mcp exited from signal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
