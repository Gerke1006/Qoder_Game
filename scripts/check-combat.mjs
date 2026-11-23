import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const errors = [], runtimeErrors = [], pending = new Map();
let server, browser, socket, profile, send, browserError, exited = false, stderr = '', sequence = 0;
let report = { checks: [] };
const fail = error => { errors.push(error?.stack || String(error)); process.exitCode = 1; };
async function waitFor(probe, label, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result) return result;
    await delay(Math.min(75, Math.max(0, deadline - Date.now())));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function findBrowser() {
  const windows = ['C:/Program Files (x86)', process.env.PROGRAMFILES, process.env.LOCALAPPDATA]
    .filter(Boolean).flatMap(base => [join(base, 'Microsoft/Edge/Application/msedge.exe'), join(base, 'Google/Chrome/Application/chrome.exe')]);
  const mac = ['/Applications', join(homedir(), 'Applications')].flatMap(base => [
    join(base, 'Google Chrome.app/Contents/MacOS/Google Chrome'), join(base, 'Microsoft Edge.app/Contents/MacOS/Microsoft Edge')
  ]);
  const names = process.platform === 'win32' ? ['msedge.exe', 'chrome.exe'] : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable'];
  const candidates = process.env.BROWSER_PATH ? [process.env.BROWSER_PATH] : [
    ...(process.platform === 'win32' ? windows : process.platform === 'darwin' ? mac : ['/opt/google/chrome/chrome', '/snap/bin/chromium']),
    ...(process.env.PATH || '').split(delimiter).filter(Boolean).flatMap(base => names.map(name => join(base, name)))
  ];
  for (const path of candidates) { try { await access(path); return path; } catch {} }
  throw new Error('Chrome/Edge not found; set BROWSER_PATH to its executable.');
}
function assertBrowser() {
  if (browserError || exited) throw browserError || new Error(`Browser exited unexpectedly: ${stderr}`);
}
function rejectPending(error) {
  for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
  pending.clear();
}
async function connect(url) {
  socket = new WebSocket(url);
  let socketError;
  socket.addEventListener('error', () => {
    socketError = new Error('CDP WebSocket error'); rejectPending(socketError);
  });
  socket.addEventListener('close', () => rejectPending(new Error('CDP WebSocket closed')));
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer); pending.delete(message.id);
      if (message.error) request.reject(new Error(JSON.stringify(message.error)));
      else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      runtimeErrors.push({ type: 'uncaught', details: message.params.exceptionDetails });
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      runtimeErrors.push({ type: 'console.error', message: message.params.args.map(arg => arg.description ?? JSON.stringify(arg.value) ?? arg.type).join(' ') });
    }
  });
  await waitFor(() => {
    assertBrowser();
    if (socketError || socket.readyState > WebSocket.OPEN) throw socketError || new Error('CDP connection closed');
    return socket.readyState === WebSocket.OPEN;
  }, 'CDP connection', 10000);
  return (method, params = {}, timeout = 20000) => new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) return reject(new Error('CDP is not connected'));
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, timeout);
    pending.set(id, { resolve, reject, timer });
    try { socket.send(JSON.stringify({ id, method, params })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
}
async function evaluate(expression, timeout = 20000) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, timeout);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
try {
  const executable = await findBrowser();
  profile = await mkdtemp(join(tmpdir(), 'combat-cdp-'));
  server = await createServer({ root, logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: true, open: false, hmr: false } });
  await server.listen();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
  browser = spawn(executable, ['--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--window-size=1280,800', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  browser.once('error', error => { browserError = error; exited = true; });
  browser.once('exit', () => { exited = true; });
  browser.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  const port = await waitFor(async () => {
    assertBrowser();
    const text = await readFile(join(profile, 'DevToolsActivePort'), 'utf8').catch(error => {
      if (error.code === 'ENOENT') return '';
      throw error;
    });
    return Number(text.split(/\r?\n/)[0]) || false;
  }, 'DevToolsActivePort');
  const page = await waitFor(async () => {
    assertBrowser();
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
      return (await response.json()).find(target => target.type === 'page' && target.webSocketDebuggerUrl);
    } catch { return false; }
  }, 'browser page');
  send = await connect(page.webSocketDebuggerUrl);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  const navigation = await send('Page.navigate', { url });
  if (navigation.errorText) throw new Error(navigation.errorText);
  await waitFor(() => evaluate('Boolean(window.game && window.game.scene && window.game.scene.isActive("MainMenu"))'), 'Phaser MainMenu', 45000);
  const result = await evaluate('import("/scripts/combat-browser.mjs").then(module => module.runCombatChecks())', 180000);
  if (!result || !Array.isArray(result.checks)) throw new Error('Combat suite returned an invalid report');
  const { screenshots, ...data } = result;
  report = data;
  for (const name of ['progression-rewards', 'progression-defense']) {
    if (!screenshots?.[name]?.startsWith('data:image/png;base64,')) throw new Error(`Missing screenshot: ${name}`);
    await writeFile(join(root, `validation/${name}.png`), Buffer.from(screenshots[name].split(',')[1], 'base64'));
  }
  const visual = await evaluate('import("/scripts/visual-browser.mjs").then(module => module.runVisualChecks())', 120000);
  report.checks.push(...visual.checks);
  for (const [name, image] of Object.entries(visual.screenshots)) {
    if (!/^visual-[a-z-]+$/.test(name) || !image.startsWith('data:image/png;base64,')) throw new Error(`Invalid visual screenshot: ${name}`);
    await writeFile(join(root, `validation/${name}.png`), Buffer.from(image.split(',')[1], 'base64'));
  }
  if (!report.checks.length || report.checks.some(check => check.pass !== true)) throw new Error('Browser checks failed or no checks ran');
} catch (error) {
  fail(error);
  if (send && socket?.readyState === WebSocket.OPEN) {
    report.checks = await evaluate('[...(window.__combatChecks || []), ...(window.__visualChecks || [])]').catch(() => []);
  }
} finally {
  if (send && socket?.readyState === WebSocket.OPEN) {
    try {
      const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      await writeFile(join(root, 'validation/combat.png'), Buffer.from(screenshot.data, 'base64'));
    } catch (error) { fail(error); }
    await send('Browser.close', {}, 2000).catch(() => {});
  }
  if (browser && !exited) {
    try { await waitFor(() => exited, 'browser shutdown', 3000); }
    catch {
      browser.kill('SIGKILL');
      await waitFor(() => exited, 'browser termination', 5000).catch(fail);
    }
  }
  socket?.close();
  rejectPending(new Error('Combat runner closed'));
  if (server) await server.close().catch(fail);
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }).catch(fail);
  report = { ...report, pass: errors.length === 0 && runtimeErrors.length === 0, errors, runtimeErrors };
  if (!report.pass) process.exitCode = 1;
  await writeFile(join(root, 'validation/combat-checks.json'), `${JSON.stringify(report, null, 2)}\n`).catch(fail);
  console.log(JSON.stringify(report, null, 2));
}
