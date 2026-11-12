const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

app.setName('Aditya Intelligence');

const ROOT = path.join(__dirname, '..');
const PORT = 18080;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const MODEL = path.join(ROOT, '.runtime', 'models', 'qwen2.5-1.5b-instruct-q4_k_m.gguf');
const SERVER = path.join(ROOT, '.runtime', 'llama', 'llama-server.exe');
let win;
let engine;
let controllers = new Map();

function historyFile() { return path.join(app.getPath('userData'), 'conversations.json'); }
function readHistory() {
  try { return JSON.parse(fs.readFileSync(historyFile(), 'utf8')); }
  catch { return { conversations: [] }; }
}
function writeHistory(data) {
  fs.mkdirSync(path.dirname(historyFile()), { recursive: true });
  fs.writeFileSync(historyFile(), JSON.stringify(data, null, 2));
}
function sendStatus(state, detail = '') { if (win && !win.isDestroyed()) win.webContents.send('engine:status', { state, detail }); }
async function ready() {
  try { return (await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(800) })).ok; }
  catch { return false; }
}
async function startEngine() {
  if (await ready()) { sendStatus('ready'); return true; }
  if (!fs.existsSync(SERVER) || !fs.existsSync(MODEL)) {
    sendStatus('missing', 'Run setup.ps1 first.'); return false;
  }
  if (engine) return false;
  const threads = Math.max(2, Math.min(6, os.cpus().length - 1));
  sendStatus('starting', 'Loading local model…');
  engine = spawn(SERVER, ['--model', MODEL, '--host', '127.0.0.1', '--port', String(PORT), '--ctx-size', '2048', '--threads', String(threads), '--parallel', '1'], { windowsHide: true });
  engine.on('exit', () => { engine = undefined; if (!app.isQuiting) sendStatus('offline', 'Local engine stopped.'); });
  engine.on('error', (error) => { engine = undefined; sendStatus('error', error.message); });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (await ready()) { sendStatus('ready'); return true; }
  }
  sendStatus('error', 'The local engine did not start.');
  return false;
}
function parseSSE(buffer, onData) {
  const parts = buffer.split('\n\n');
  const rest = parts.pop();
  for (const part of parts) {
    for (const line of part.split('\n')) if (line.startsWith('data: ')) onData(line.slice(6));
  }
  return rest;
}
async function streamChat(event, { requestId, messages }) {
  const controller = new AbortController(); controllers.set(requestId, controller);
  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ model: 'local', messages, stream: true, temperature: 0.7, max_tokens: 512 })
    });
    if (!response.ok || !response.body) throw new Error(`Local engine returned ${response.status}`);
    const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = '';
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      pending = parseSSE(pending, payload => {
        if (payload === '[DONE]') return;
        try { const token = JSON.parse(payload).choices?.[0]?.delta?.content; if (token) event.sender.send('chat:token', { requestId, token }); } catch { /* ignore incomplete event */ }
      });
      if (done) break;
    }
    event.sender.send('chat:done', { requestId, stopped: false });
  } catch (error) {
    event.sender.send('chat:done', { requestId, stopped: controller.signal.aborted, error: controller.signal.aborted ? '' : error.message });
  } finally { controllers.delete(requestId); }
}

function createWindow() {
  win = new BrowserWindow({ width: 1050, height: 760, minWidth: 700, minHeight: 560, backgroundColor: '#10141c', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.once('did-finish-load', startEngine);
}
app.whenReady().then(() => {
  ipcMain.handle('engine:status', async () => ({ ready: await ready() }));
  ipcMain.handle('history:load', () => readHistory());
  ipcMain.handle('history:save', (_event, data) => writeHistory(data));
  ipcMain.handle('chat:start', (event, payload) => streamChat(event, payload));
  ipcMain.handle('chat:stop', (_event, id) => controllers.get(id)?.abort());
  ipcMain.handle('dialog:confirm-clear', () => dialog.showMessageBox(win, { type: 'warning', buttons: ['Clear chat', 'Cancel'], defaultId: 1, cancelId: 1, message: 'Clear this conversation?', detail: 'This removes the messages from local history.' }).then(r => r.response === 0));
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { app.isQuiting = true; controllers.forEach(c => c.abort()); if (engine) engine.kill(); });
