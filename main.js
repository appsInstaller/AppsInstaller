const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const ipc = ipcMain
const process = require('process');
const EventEmitter = require('events')
// const log = require('electron-log');
// const {autoUpdater} = require("electron-updater");

const loadingEvents = new EventEmitter()

const createWindow = (width, height) => {
    let win = new BrowserWindow({
        // minWidth : width,
        // minHeight : height,
        width,
        height,
        autoHideMenuBar: true,
        frame: false,
        // x: 0,
        // y: 0,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devtools: true,
        }
    })
    
    win.loadFile('index.html')
    // Our loadingEvents object listens for 'finished'
    // loadingEvents.on('finished', () => {
    //     win.loadFile('index.html')
    // })

    // Controllers
    ipc.on("app_ready", () =>{
        console.log("main ready")
        loadingEvents.emit('finished')
    })
    ipc.on("close_window", () =>  {
        win.close();
    })
    ipc.on("minimize_window", () =>  win.minimize())
    ipc.on("resize_window", () =>  {
        win.isMaximized() ? win.restore() : win.maximize()
    })

    win.on('maximize', () => win.webContents.send("maximized"))
    win.on('unmaximize', () => win.webContents.send("restored"))

    ipc.on("selectFolders", () => {
        dialog.showOpenDialog({
            // title: "Hello",
            defaultPath: "D:\\ArkarMaungMaung\\apk",
            properties: ['openDirectory', 'multiSelections'],
            // filters: [
            //     { name: 'Apps', extensions: ['apk', 'xapk', 'xapks'] }
            // ]
            // 
          }).then(result => {
            if(result.filePaths.length > 0) {
                win.webContents.send("dirPaths", result.filePaths)
            }
          }).catch(err => {
            console.log(err)
          })
    })
    
    
}

// autoUpdater.on('checking-for-update', () => {
//     console.log('Checking for update...');
// })
// autoUpdater.on('update-available', (info) => {
//     console.log('Update available.');
// })
// autoUpdater.on('update-not-available', (info) => {
//     console.log('Update not available.');
// })
// autoUpdater.on('error', (err) => {
//     console.log('Error in auto-updater. ' + err);
// })
// autoUpdater.on('download-progress', (progressObj) => {
//     let log_message = "Download speed: " + progressObj.bytesPerSecond;
//     log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
//     log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
//     console.log('log_message', log_message);
// })
// autoUpdater.on('update-downloaded', (info) => {
//     console.log('Update downloaded');
// });

app.whenReady().then(() => {
    // autoUpdater.checkForUpdatesAndNotify();

     // We cannot require the screen module until the app is ready.
    const { screen } = require('electron')

    // Create a window that fills the screen's available work area.
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    // console.log("screen.getPrimaryDisplay()", screen.getPrimaryDisplay(), screen.getPrimaryDisplay().workAreaSize, width * .8)
    createWindow(width / 1.2, height / 1.2)
    // console.log("Cache", process.env.APPDATA + "\\"+ app.getName() + "\\Cache");
    app.on("activate", () => {
        if(BrowserWindow.getAllWindows().length === 0) createWindow(width / 1.2, height / 1.2)
    })
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
})

try {
    require('electron-reloader')(module)
} catch (_) {}