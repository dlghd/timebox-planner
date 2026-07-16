const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

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

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); });
