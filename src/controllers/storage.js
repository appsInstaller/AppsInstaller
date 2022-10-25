const storage = require('electron-json-storage');
const os = require('os');
const path = require('path');

const tmpPath = path.join(os.tmpdir(), "appsInstaller")
storage.setDataPath(tmpPath);

const dataPath = storage.getDataPath();

function save_data(key, value, apk_path) {
    storage.set(key, value, function(error) {
        if (error) throw error;
        // To know how apps are stored in temp folder for this session usage
        const currentTemped = JSON.parse(window.sessionStorage.getItem('currentTemped')) || []
        if(!currentTemped.map(c => c.toString()).includes(apk_path)) {
            window.sessionStorage.setItem('currentTemped',JSON.stringify([...new Set([...currentTemped, apk_path])]))
        }
    });
}
function get_data(key) {
    if(!key) return false;
    return storage.getSync(key);
}
module.exports = {save_data, get_data, tmpPath}