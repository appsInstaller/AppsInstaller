const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const ipc = ipcMain
var path = require("path")
const process = require('process');
const {autoUpdater} = require("electron-updater");

// autoUpdater.setFeedURL({
//     provider: 'github',
//     repo: 'appsInstaller',
//     owner: 'appsInstaller',
//     private: false,
//     token: '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'
// })
autoUpdater.autoDownload = false
// autoUpdater.allowPrerelease = true
// autoUpdater.updateConfigPath = path.join(
//     __dirname,
//     'app-update.yml'
// );

Object.defineProperty(app, 'isPackaged', {
  get() {
    return true;
  }
});
let win = false

const createWindow = (width, height) => {
    win = new BrowserWindow({
        // minWidth : width,
        // minHeight : height,
        width,
        height,
        autoHideMenuBar: true,
        frame: false,
        // x: 0,
        // y: 0,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            devtools: true,
            
        }
    })
    win.loadFile('index.html')
    
    // win.webContents.on('did-finish-load', function () {
    //     // win.webContents.send("app_update", {'update_in_download_progress': { percentage: 1.3038936054668775, total_size: 1255854, transferred_size : 16375}})
    // });
    // Our loadingEvents object listens for 'finished'
    // loadingEvents.on('finished', () => {
    //     win.loadFile('index.html')
    // })

    // Controllers
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
    
    ipc.on('download_app_update', () => {
        win.webContents.send("app_update", {'update_preparing': true})
        
        autoUpdater.downloadUpdate()
        // .then(() => {
        //     console.log("Update Finished")
        // })
        // .catch((err) => console.log('err -------- ', err))
    })

    ipc.on('restart_app_update', () => {
        // app.relaunch()
        // app.exit()
        autoUpdater.quitAndInstall()
    })
}

// autoUpdater.on('checking-for-update', () => {
//     console.log('Checking for update...');
//     win.webContents.send("dirPaths", 'update_avaiable')
// })
autoUpdater.on('update-available', (info) => {
    console.log('Update available.', JSON.stringify(info));
    win.webContents.send("app_update", {'update_avaiable': true})
})
autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available.', info);
    win.webContents.send("app_version", app.getVersion())
})
// autoUpdater.on('error', (err) => {
//     console.log('Error in auto-updater. ' + err);
// })

autoUpdater.on('download-progress', (progressObj) => {
    win.webContents.send("app_update", {'update_in_download_progress': { percentage: progressObj.percent, total_size: progressObj.total, transferred_size : progressObj.transferred}})
})
autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded', info);
    win.webContents.send("app_update", {'update_downloaded': JSON.stringify(info)})
});

app.whenReady().then(() => {

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
    autoUpdater.checkForUpdatesAndNotify();
})

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit()
})

try {
    require('electron-reloader')(module)
} catch (_) {}