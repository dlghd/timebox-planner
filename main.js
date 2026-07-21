const { app, BrowserWindow, ipcMain, dialog, screen, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  // D(데일리 플래너) 화면 폭에 맞추고, 세로는 화면 작업영역 최대로
  const wa = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(850, wa.width),
    height: wa.height,
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

// 일정 시작 알림 — 포커스를 뺏지 않고(작업 방해 X) 항상 맨 앞에 뜨는 팝업
let alarmWin = null;
ipcMain.on('notify', (e, { title, body }) => {
  const esc = s => String(s || '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const wa = screen.getPrimaryDisplay().workAreaSize;
  const W = 340, H = 100;

  if (alarmWin && !alarmWin.isDestroyed()) { alarmWin.close(); alarmWin = null; }
  alarmWin = new BrowserWindow({
    width: W, height: H,
    x: wa.width - W - 18,
    y: wa.height - H - 18,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,      // 포커스를 가져가지 않아 하던 작업을 방해하지 않음
    hasShadow: false,
    show: false,
  });
  alarmWin.setAlwaysOnTop(true, 'screen-saver');   // 다른 창·전체화면 위에도 표시

  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:'Malgun Gothic',sans-serif}
    .card{margin:8px;height:calc(100% - 16px);background:#222;border-radius:13px;color:#fff;
      display:flex;align-items:center;gap:13px;padding:0 17px;box-shadow:0 8px 26px rgba(0,0,0,.45);
      border-left:6px solid #e05d5d;animation:pop .4s cubic-bezier(.2,1.35,.45,1)}
    @keyframes pop{from{transform:translateY(34px) scale(.96);opacity:0}to{transform:none;opacity:1}}
    .ic{font-size:27px;animation:sh .6s ease 2}
    @keyframes sh{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
    .tx{flex:1;min-width:0}
    .t{font-size:12px;color:#ff9a9a;font-weight:700;margin-bottom:3px}
    .b{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  </style><div class="card"><div class="ic">⏰</div><div class="tx">
    <div class="t">${esc(title)}</div><div class="b">${esc(body)}</div></div></div>`;

  alarmWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  alarmWin.showInactive();   // 포커스 없이 표시
  setTimeout(() => {
    if (alarmWin && !alarmWin.isDestroyed()) { alarmWin.close(); alarmWin = null; }
  }, 5000);
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
    return { ok: true, file: j, folder: path.dirname(f) };
  } catch {
    return { ok: false, reason: 'no-file', folder: path.dirname(f) };
  }
});

ipcMain.on('sync-save', (e, payload) => {
  const f = dataFilePath();
  if (!f || !payload) return;
  try { fs.writeFileSync(f, JSON.stringify(payload)); } catch { /* 클라우드 폴더 일시 접근 불가 무시 */ }
});

// ── 메모 서브창 (트리플클릭) ──
ipcMain.on('open-memo', (e, { title, html }) => {
  const esc = s => String(s || '').replace(/</g, '&lt;');
  const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: "Malgun Gothic", "Segoe UI", sans-serif; padding: 16px 20px; margin: 0;
         font-size: 14px; line-height: 1.7; word-break: break-all; color: #222; }
  h3 { font-size: 13px; color: #888; font-weight: 600; margin: 0 0 10px;
       padding-bottom: 8px; border-bottom: 1.5px solid #222; }
</style></head><body><h3>${esc(title)}</h3><div>${html}</div></body></html>`;

  const sub = new BrowserWindow({
    width: 460,
    height: 300,
    parent: win,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    title: title,
  });
  sub.setMenuBarVisibility(false);
  sub.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page));
  // 글자가 다 보이도록 내용 높이에 맞춰 창 크기 조절
  sub.webContents.once('did-finish-load', () => {
    sub.webContents.executeJavaScript('document.body.scrollHeight').then(h => {
      const wa = screen.getPrimaryDisplay().workAreaSize;
      sub.setContentSize(460, Math.min(Math.max(h + 24, 160), wa.height - 80));
    }).catch(() => {});
  });
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); });
