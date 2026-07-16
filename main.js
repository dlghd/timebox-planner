const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 860,
    height: 780,
    minWidth: 420,
    minHeight: 480,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: 'Timebox Planner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      spellcheck: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
  win.on('closed', () => { win = null; });
}

app.whenReady().then(createWindow);

ipcMain.on('set-opacity', (e, v) => {
  if (win) win.setOpacity(Math.max(0.3, Math.min(1, Number(v) || 1)));
});

ipcMain.on('set-pin', (e, on) => {
  if (win) win.setAlwaysOnTop(!!on);
});

// ── 클라우드 폴더 동기화 ──
const configPath = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8')); } catch { return {}; }
}

function dataFilePath() {
  const c = readConfig();
  return c.syncFolder ? path.join(c.syncFolder, 'timebox-data.json') : null;
}

ipcMain.handle('choose-sync-folder', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '동기화 폴더 선택 (OneDrive/구글드라이브 폴더 권장)',
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const c = readConfig();
  c.syncFolder = r.filePaths[0];
  try { fs.writeFileSync(configPath(), JSON.stringify(c)); } catch (e) { return { ok: false }; }
  return { ok: true, folder: c.syncFolder };
});

ipcMain.handle('sync-load', () => {
  const f = dataFilePath();
  if (!f) return { ok: false, reason: 'no-folder' };
  try {
    const j = JSON.parse(fs.readFileSync(f, 'utf8'));
    return { ok: true, savedAt: j.savedAt || 0, data: j.data || {}, folder: path.dirname(f) };
  } catch {
    return { ok: false, reason: 'no-file', folder: path.dirname(f) };
  }
});

ipcMain.on('sync-save', (e, payload) => {
  const f = dataFilePath();
  if (!f || !payload) return;
  try { fs.writeFileSync(f, JSON.stringify(payload)); } catch { /* 클라우드 폴더 일시 접근 불가 무시 */ }
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); });
