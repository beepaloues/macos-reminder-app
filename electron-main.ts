import { app, BrowserWindow, Tray, nativeImage, ipcMain, Notification } from 'electron';
import * as path from 'path';

let tray: any = null;
let window: any = null;

let reminders: any[] = [];

function createWindow() {
  window = new BrowserWindow({
    width: 300,
    height: 400,
    show: false,
    frame: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  window.loadURL('http://localhost:3000');

  window.on('blur', () => {
    if (window) {
      window.hide();
    }
  });
}

function toggleWindow() {
  if (!window) {
    return;
  }
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
}

function showWindow() {
  if (!window) {
    return;
  }
  const trayBounds = tray?.getBounds();
  const windowBounds = window.getBounds();

  let x = Math.round(trayBounds!.x + trayBounds!.width / 2 - windowBounds.width / 2);
  let y = Math.round(trayBounds!.y + trayBounds!.height);

  window.setPosition(x, y, false);
  window.show();
  window.focus();
}

function scheduleReminder(reminder: any) {
  const now = new Date();
  const reminderTime = new Date(reminder.time);
  let delay = reminderTime.getTime() - now.getTime();

  if (delay < 0) {
    // If time is in the past, ignore or handle recurrence
    if (reminder.recurrence) {
      delay = reminder.recurrence - (now.getTime() - reminderTime.getTime()) % reminder.recurrence;
    } else {
      return;
    }
  }

  setTimeout(() => {
    triggerReminder(reminder);
    if (reminder.recurrence) {
      // Reschedule
      reminder.time = new Date(Date.now() + reminder.recurrence).toISOString();
      scheduleReminder(reminder);
    } else {
      reminders = reminders.filter((r) => r.id !== reminder.id);
      window.webContents.send('reminder-removed', reminder.id);
    }
  }, delay);
}

function triggerReminder(reminder: any) {
  if (reminder.type === 'notification') {
    new Notification({ title: 'Reminder', body: reminder.text }).show();
  } else if (reminder.type === 'popup') {
    // Send IPC to renderer to show modal
    window.webContents.send('show-popup', reminder);
  }
}

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, 'tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);
  tray.setToolTip('Reminder App');
  tray.on('click', toggleWindow);

  createWindow();

  ipcMain.on('add-reminder', (event: any, reminder: any) => {
    reminders.push(reminder);
    scheduleReminder(reminder);
    window.webContents.send('reminder-added', reminder);
  });

  ipcMain.on('delete-reminder', (event: any, id: any) => {
    reminders = reminders.filter((r) => r.id !== id);
    window.webContents.send('reminder-removed', id);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Do not quit app when window is closed, keep tray active
});
