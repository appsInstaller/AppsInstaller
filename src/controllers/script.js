const { ipcRenderer } = require("electron");
const os = require('os');
const fs = require('fs');
var path = require("path")
const {Apk} = require("node-apk");
var gplay = require('google-play-scraper');
const ipc = ipcRenderer;
const { sendMail } = require('./src/controllers/mail.js');

const { save_data, get_data, tmpPath } = require('./src/controllers/storage.js');
const { resolve } = require("path");
const { spawn, spawnSync } = require('child_process');
var selected_apps = []

// sdk version to android version
let sdk_to_av = {
    "1" : "Android 1.0 +" , // BASE
    "2" : "Android 1.1 +" , // BASE_1_1
    "3" : "Android 1.5 +" , // CUPCAKE
    "4" : "Android 1.6 +" , // DONUT
    "5" : "Android 2.0 +" , // ECLAIR
    "6" : "Android 2.0.1 +" , // ECLAIR_0_1
    "8" : "Android 2.2 +" , // FROYO
    "9" : "Android 2.3.0 +" , // GINGERBREAD ( Android 2.3.0 – 2.3.2 )
    "10" : "Android 2.3.3 +" , // GINGERBREAD_MR1 ( Android 2.3.3 – 2.3.7 )
    "11" : "Android 3.0 +" , // HONEYCOMB
    "12" : "Android 3.1 +" , // HONEYCOMB_MR1
    "13" : "Android 3.2 +" , // HONEYCOMB_MR2
    "14" : "Android 4.0.1 +" , // ICE_CREAM_SANDWICH  ( Android 4.0.1 – 4.0.2 )
    "15" : "Android 4.0.3 +" , // ICE_CREAM_SANDWICH_MR1  ( Android 4.0.3 – 4.0.4 )
    "16" : "Android 4.1 +" , // JELLY_BEAN
    "17" : "Android 4.2 +" , // JELLY_BEAN_MR1
    "18" : "Android 4.3 +" , // JELLY_BEAN_MR2
    "19" : "Android 4.4 +" , // KITKAT
    "20" : "Android 4.4W +" , // KITKAT_WATCH
    "21" : "Android 5 +" , // LOLLIPOP, L
    "22" : "Android 5.1 +" , // LOLLIPOP_MR1
    "23" : "Android 6 +" , // Marshmallow
    "24" : "Android 7.0 +" , // N ( Nougat )
    "25" : "Android 7.1 +" , // N_MR1
    "26" : "Android 8.0 +" , // O (OREO)
    "27" : "Android 8.1 +" , // O_MR1
    "28" : "Android 9 +" , // p (Pie)
    "29" : "Android 10 +" , // Q (Quince Tart)
    "30" : "Android 11 +" , // R (Red Velvet Cake)
    "31" : "Android 12 +" , // S ( Snow Cone )
    "32" : "Android 12L +" , // S_V2
    "33" : "Android 13 +" , // TIRAMISU
}
let installStatus = {
    "apk" : [
        "Size",
        "Waiting",
        "Installing",
        'Done',
        'Not Installed',
        'Cancelled',
        'Error'
    ],
    "obbapk" : [
        "Size",
        "Waiting",
        "Preparing",
        "Pushing OBB",
        "Installing APK",
        'Done',
        'Not Installed',
        'Cancelled',
        'Error'
    ],
    'splitapks' : [
        "Size",
        "Waiting",
        "Preparing",
        "Extracting APKs",
        "Installing APKs",
        "Done",
        'Not Installed',
        'Cancelled',
        'Error',
        'Finishing'
    ]
}


function remove_attachment(name) {
    console.log('name', name)
    document.querySelector(`.attachment[data-name="${name}"]`).remove()
}

function attachments_onmousewheel(container, evt) {
    evt.preventDefault();
    container.scrollLeft += evt.deltaY * -1;
}

function textarea_value_change(textarea) {
    if(textarea.value) {
        document.querySelector('[value="send_mail"]').classList.remove('disabled')
    } else {
        
        document.querySelector('[value="send_mail"]').classList.add('disabled')
    }
}
function preview_attachment_files(input) {
    const files = input.files;
    const attchments_container = document.querySelector('.attchments');

    if(files.length > 0) {
        for(let f of files) {
            let extension = f.path.split('.').at(-1)
            if(!['apng', 'avif', 'gif', "jpg", "jpeg", "jfif", "pjpeg", "pjp", 'png', 'svg', 'webp', 'txt', 'pdf'].includes(extension)) {
                continue
            }
            let attachment =  document.createElement('span');
            attachment.className = 'attachment'
            attachment.setAttribute('data-name', f.name)
            attachment.setAttribute('data-path', f.path)
            
            const remove_attachment_btn = document.createElement('span');
            remove_attachment_btn.className = 'remove_attachment_btn'
            remove_attachment_btn.innerHTML = closeIcon
            remove_attachment_btn.onclick = () => remove_attachment(f.name)

            let attachment_content = document.createElement('div');
            attachment_content.className = 'attachment_content'
            attachment_content.setAttribute('data-attachment_type', extension.toUpperCase())

            if(f.type.startsWith('image/')) {
                let preview_image = document.createElement('img'); 
                preview_image.src = URL.createObjectURL(f)
                attachment_content.append(preview_image)
                attachment_content.setAttribute('data-has_file', 'true')

            } 
            attachment.append(attachment_content)
            attachment.append(remove_attachment_btn)
            attchments_container.append(attachment)
        }
    }
}

function email_popUp_open(e, open) {
    e.preventDefault()
    e.stopPropagation()
    const email_form_popUp = document.querySelector('.popUpBackground');
    const submit_btn = document.querySelector('[value="send_mail"]');
    const msg = document.querySelector('#email_form .msg')

    open ? 
        email_form_popUp.classList.add('show'):
        email_form_popUp.classList.remove('show')

        
    msg.value ?
        submit_btn.classList.remove('disabled'):
        submit_btn.classList.add('disabled')
}

document.querySelector('#email_form').addEventListener('submit', async(e) => {
    e.preventDefault();
    e.stopPropagation()
    const mail_type = document.querySelector('#email_form .mail_type_value')
    const msg = document.querySelector('#email_form .msg')
    const mail_submit_btn = document.querySelector('#email_form [value="send_mail"]')
    
    const attachment_files = document.querySelectorAll('.attachment');
    let files = []
    if(attachment_files) {
        for(let a of attachment_files) {
            files.push({'filename': a.getAttribute('data-name'), 'path': a.getAttribute('data-path')})
        }
    }

    
    mail_submit_btn.innerHTML = 'Sending ...'
    await sendMail(msg.value, mail_type.innerHTML, files)
        .then(() => mail_submit_btn.innerHTML = 'Send')
        .catch((err) => {
            mail_submit_btn.innerHTML = 'Try again'
        })
})

// Get xapk, apk inside directory
function listdir(dir_path) {
    console.log("listdir")
    return fs.readdirSync(dir_path, {withFileTypes: true})
    .filter(item => !item.isDirectory() && new Set(["xapk", "apk"]).has(item.name.split('.').at(-1)))
    .map(item => item.name)
}

function get_app_label(apk_name, resources, manifest) {
    console.log("get_app_label", apk_name)
    // try {
    //     const all = resources.resolve(manifest.applicationLabel);
    //     label = (all.find((res) => (res.locale && res.locale.language === "fr")) || all[0]).value;
    // } catch {
    //     label = apk_name.split('.').at(0)
    // }
    return apk_name.replace(/(.xapk|.apk)$/g, '')
}

async function get_app_icon_3(packageName) {
    console.log("get_app_icon_3")
    try {
        return await gplay.app({appId: packageName})
        .then(data => {
            return data["icon"]
        });
    } catch {
        return false
    }
}

async function get_app_icon_2(apk_path) {
    return new Promise((resolve, reject) => {
        let dataString = ''
        const dumpProcess = spawn(`aapt`, ['dump', 'badging', apk_path])
        
        dumpProcess.stdout.on('data', (data) => {
            // console.log("data -> ", data.toString())
            dataString += data.toString()
        });

        dumpProcess.on('close', () => {
            const temp_dir_path = path.join(tmpPath, get_app_label(path.basename(apk_path)))
            const icon_path = dataString.split('\n').filter(l => l.includes('icon=') && l.includes('application'))[0]
            const iconPath = icon_path.slice(icon_path.indexOf("icon=") + 6, icon_path.length - 2)
            console.log("iconPath --------------------------- ", iconPath, temp_dir_path)
            let extract_icon = spawn('7z', ['e', apk_path, iconPath, '-r', '-y', `-o${temp_dir_path}`])

            extract_icon.on('close', () => {
                const temp_icon_path = path.join(temp_dir_path, path.basename(iconPath))
               
                convert(temp_icon_path)
                .then((data) => {
                    resolve(data)
                })
            })

        })
    })
}

async function get_app_icon_1(apk, manifest, resources) {
    console.log("get_app_icon_1")
    try {
        let iconNumber = manifest.applicationIcon;
        // console.log("iconNumber", iconNumber, resources, manifest, resources.resolve(iconNumber)[0].value, apk.extract(resources.resolve(iconNumber)[0].value))
        return await apk.extract(resources.resolve(iconNumber)[0].value)
    } catch {
        return false
    }
}

function formatBytes(bytes, decimals = 2) {
    console.log("formatBytes")
    if (!+bytes) return false

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function apk_show_full_name(ev, show) {
    console.log("apk_show_full_name")
    const { currentTarget: app} = ev;
    const more_info = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .app_more_info`);
    const app_type = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .app_type`);

    if(show && app.classList.contains("shorthanded")) {
        more_info.classList.add('show_apk_type')
        app.classList.add('show_full_name')
        app_type.classList.add('hide')
    } else {
        more_info.classList.remove('show_apk_type')
        app.classList.remove('show_full_name')
        app_type.classList.remove('hide')
    }
}

document.querySelector('.mainWindow__center__apps_list').addEventListener('mousemove', (ev) => {
    
    console.log("mainWindow__center__apps_list mousemove")
    const apps = document.querySelectorAll('.mainWindow__center__apps_list__app');
    apps.forEach(app => {
       
        const rect = app.getBoundingClientRect()
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const hover_effect_width = Math.round(rect.width * 1.6)
        const hover_border_width = Math.round(rect.width * .6)

        app.style.setProperty("--mouse-x", `${x}px`)
        app.style.setProperty("--mouse-y", `${y}px`)
        app.style.setProperty("--hover_effect_width", `${hover_effect_width}px`)
        app.style.setProperty("--hover_border_width", `${hover_border_width}px`)
    })
})

function change_selectAll_deselectAll_status(checked) {
    console.log("change_selectAll_deselectAll_status")
    var element = document.querySelector('.mainWindow__center__bottom__left');
    if(checked) {
        element.firstElementChild.innerHTML = `
            <path d="M426.666667 725.333333l-213.333334-213.333333 60.16-60.586667L426.666667 604.586667l323.84-323.84L810.666667 341.333333m0-213.333333H213.333333c-47.36 0-85.333333 37.973333-85.333333 85.333333v597.333334a85.333333 85.333333 0 0 0 85.333333 85.333333h597.333334a85.333333 85.333333 0 0 0 85.333333-85.333333V213.333333a85.333333 85.333333 0 0 0-85.333333-85.333333z" fill=""/>
        `
        element.lastElementChild.innerHTML = "Deselect All"
    } else {
        element.firstElementChild.innerHTML = `
            <path d="M227.487 892.447c-50.919 0-92.345-41.426-92.345-92.345V222.49c0-50.14 40.791-90.932 90.932-90.932h573.291c49.347 0 89.493 40.146 89.493 89.493V801.9c0 49.925-40.622 90.547-90.548 90.547H227.487z m11.197-706.74c-27.233 0-49.387 22.155-49.387 49.388v552.817c0 27.78 22.6 50.38 50.38 50.38h546.08c26.992 0 48.957-21.96 48.957-48.957V235.254c0-27.32-22.226-49.546-49.547-49.546H238.684z"/>
        `
        element.lastElementChild.innerHTML = "Select All"
    }
}


function get_active_folders() {
    console.log("get_active_folders")
    return [...document.querySelectorAll('.mainWindow__left__folders_list_folder.active')].map(f => f.getAttribute('data-id'))
}
function get_active_folders_apps() {
    console.log("get_active_folders_apps")
    return [...document.querySelectorAll('.mainWindow__center__apps_list__app')].filter(a => [...document.querySelectorAll('.mainWindow__left__folders_list_folder.active')].map(f => f.getAttribute('data-id')).includes(a.getAttribute('data-parent')))
}
// Select/ Deselect all apps
function select_or_deselect_all_apps() {
    console.log("select_or_deselect_all_apps")
    const apps = get_active_folders_apps()
    if(apps.length === 0) return
    if(!is_all_apps_selected()) {
        apps.map(app =>  change_apk_selectedState(app.getAttribute("data-id"), state = "add"))
    } else {
        apps.map(app =>  change_apk_selectedState(app.getAttribute("data-id"), state = "remove"))
    }
}
function is_all_apps_selected() { 
    console.log("is_all_apps_selected")
    if(!selected_apps.length > 0) {
        return false
    }
    return selected_apps.length === get_active_folders_apps().length }

function changeSelectedAppStatus() {
    console.log("changeSelectedAppStatus")
    var selected_apps_total_size = formatBytes(selected_apps.map(a => parseInt(a.getAttribute('data-apk-size'))).reduce((total, current) => total + current, 0));
    document.querySelector(".apps_to_install_info").innerHTML = `${selected_apps.length} Selected App${selected_apps.length > 1 ? "s" : ""}${selected_apps_total_size ? " ( " + selected_apps_total_size + " ) ": ""}`
}
function change_apk_selectedState(formatted_path, state = false) {
    console.log("change_apk_selectedState")
    const apk = document.querySelector(`[data-id=${formatted_path}]`)
    const app_selectedIcon = document.querySelector(`[data-id=${formatted_path}] .app_selectedIcon`)
    if(!state) {
        apk.classList.toggle('selected')
    } else {
        state == 'add' ? apk.classList.add('selected') :  apk.classList.remove('selected')
    }

    if(apk.classList.contains('selected')) {
        app_selectedIcon.innerHTML = checkedIcon

        if(!selected_apps.map(a => a.getAttribute('data-path')).includes(apk.getAttribute('data-path'))) {
            selected_apps.push(apk)
        }
    } else {
        app_selectedIcon.innerHTML = uncheckedIcon
        selected_apps.splice(selected_apps.indexOf(apk), 1)
    }
        
    change_selectAll_deselectAll_status(is_all_apps_selected())

    changeSelectedAppStatus()
    
}

async function apk_clicked(formatted_path) {  
    console.log("apk_clicked")
    var clicked_apps = document.querySelectorAll(`.mainWindow__center__apps_list__app[data-id=${formatted_path}]`)
    clicked_apps.forEach(ca => change_apk_selectedState(ca.getAttribute("data-id")))
 }

const isUrl = urlString=> {
    try { 
        return Boolean(new URL(urlString)); 
    }
    catch(e){ 
        return false; 
    }
}

function keep_in_current_temped(apk_path) {
    const currentTemped = JSON.parse(window.sessionStorage.getItem('currentTemped')) || []
    if(!currentTemped.map(c => c.toString()).includes(apk_path)) {
        window.sessionStorage.setItem('currentTemped',JSON.stringify([...new Set([...currentTemped, apk_path])]))
    }
}
function keep_in_current_Apps(apk_name, apk_path) {
    console.log("keep_in_current_Apps")
    const currentApps = JSON.parse(window.sessionStorage.getItem('currentApps')) || []
    if(!currentApps.map(c => Object.keys(c).toString()).includes(apk_name) || !currentApps.map(c => Object.values(c).toString()).includes(apk_path)) {
        window.sessionStorage.setItem('currentApps',JSON.stringify([...currentApps, {[apk_name]: apk_path}]))
    }
}

function shorthand_long_Name(formatted_path, name, database_name, min, max) {
    console.log("shorthand_apkName")
    let shorthand_apkNames = JSON.parse(window.localStorage.getItem(database_name)) || []
    const name_length = Math.floor(Math.random() * (max - min) ) + min;
    const shorthanded = name.length > name_length;
    const shorthanded_name = shorthanded ? `${name.substr(0, name_length)} ...` : name

    if(shorthand_apkNames.map(c => Object.keys(c).toString()).includes(formatted_path)) {
        return {
            "shorthanded_name": Object.values(shorthand_apkNames.filter(f => Object.keys(f).toString() === formatted_path)[0]).toString(), 
            "shorthanded": shorthanded
        }
    }

    if(!shorthand_apkNames.map(c => Object.keys(c).toString()).includes(formatted_path)) {
        window.localStorage.setItem(database_name, JSON.stringify([...shorthand_apkNames, {[formatted_path]: shorthanded_name}]))

    }
    return {
        "shorthanded_name": shorthanded_name, 
        "shorthanded": shorthanded
    }
}

function show_error(e, data_id) {
    console.log("show_error")
    e.preventDefault();
    e.stopPropagation();
    const app_err_content = document.querySelector(`.${data_id}.error_content`);
    app_err_content.classList.add('show')
}

function close_report(e, data_id) {
    console.log("close_report")
    e.preventDefault();
    e.stopPropagation();
    const app_err_content = document.querySelector(`.${data_id}.error_content`);
    app_err_content.classList.remove('show')
}

async function report_error(data_id) {
    const app_err_content = document.querySelector(`.${data_id}.error_content`);
    const app_err = document.querySelector(`.${data_id}.error_content .error_details`);
    const error_report_btn = document.querySelector(`.${data_id}.error_content .error_report_btn`);
    
    let err_msg = app_err.innerHTML

    if(!err_msg) {
        return
    }

    error_report_btn.innerHTML = 'Reporting'
    await sendMail(err_msg, 'Error')
    .then(() => {
        app_err.innerHTML = "Thanks for your report 😎."
        error_report_btn.innerHTML = 'Report'
        
        setTimeout(() => {
            app_err.innerHTML = err_msg
            app_err_content.classList.remove('show')
        }, 2500)
    })
    .catch(() => {
        error_report_btn.innerHTML = 'Try again'
    })
}

function add_apk_to_html(apk_path, formatted_path, { apk_name,  apk_package_name, apk_total_size, apk_version_code, apk_version_name, apk_icon, min_sdk_version, split_apks, expansions}, folder_path, searchResult = false, append_if_not_exist = false) {
    console.log("add_apk_to_html", apk_path)
    const {shorthanded_name, shorthanded} = shorthand_long_Name(formatted_path, apk_name, 'shorthand_apkNames', 20, 30)
    const already_selected = selected_apps.map(a => a.getAttribute('data-path')).includes(formatted_path);
    let apkType = false
    if(expansions !== undefined && split_apks !== undefined) { apkType = 'obbapk' }
    else if(expansions === undefined && split_apks === undefined) { apkType = "apk"} 
    else { apkType = "splitapks"}

    let simpleApkType = apkType === 'apk' ? 'apk' : 'xapk'
    // console.log("apk_name", apk_path, apk_name, apkType, simpleApkType, expansions, split_apks)
    var data_id = get_key_for_apk(apk_package_name, apk_version_name, apk_version_code, apk_name);

    const container = document.querySelector('.mainWindow__center__apps_list');
    const appHTML = document.createElement('div')
    appHTML.className = `mainWindow__center__apps_list__app ${shorthanded ? 'shorthanded' : ""} ${searchResult ? 'search-item' : 'main-item'} ${already_selected ? 'selected' : ""}`
    appHTML.setAttribute("data-parent", `${window.localStorage.getItem(folder_path)}`)
    appHTML.setAttribute("data-id", formatted_path)
    appHTML.setAttribute("data-path", formatted_path)
    appHTML.setAttribute("data-apk-size", apk_total_size)
    appHTML.onclick = () => apk_clicked(formatted_path)
    appHTML.onmouseenter = (ev) => apk_show_full_name(ev, true)
    appHTML.onmouseleave = (ev) => apk_show_full_name(ev, false)

    const appBorder = document.createElement('div');
    appBorder.className = "appBorder"

    const appContents = document.createElement('div');
    appContents.className = "appContents"

    const appSelected = document.createElement('span');
    appSelected.className = "app_selectedIcon"
    appSelected.innerHTML =  already_selected ? checkedIcon : uncheckedIcon

    const leftDiv = document.createElement('div')
    leftDiv.setAttribute('class', "mainWindow__center__apps_list__app__left")
    // appHTML.setAttribute('data-name', apk_name)
    leftDiv.innerHTML = `
        <img class = "app_logo app_logo_${formatted_path}" src = "" />
        <div class = "app_info">
            <div class = "app_name_type">
                <p class = "app_name app_name_${formatted_path}" data-width-ch = ${apk_name.replace(/\s/g, '_').length} data-name = ${apk_name.replace(/\s/g, '_')}></p>
                <p class = "app_type app_type_${formatted_path}"></p>
            </div>
            <div class = "app_more_info">
                <p class = "app_more_info__version app_more_info__version_${formatted_path}"></p>
                <p class = "app_more_info__required_android_version">
                    ${min_sdk_version ? sdk_to_av[min_sdk_version] : ""}
                </p> 
                <p class = "app_more_info__apk_type">
                    ${simpleApkType}
                </p> 
                <p class = "app_more_info__apk_size">
                    ${formatBytes(apk_total_size)}
                </p> 
            </div>
            
            <div class = "app_folder_path"> 
                <p> ${folder_path} </p>
            </div>
        </div>
    `

    const rightDiv = document.createElement('div')
    rightDiv.setAttribute('class', "mainWindow__center__apps_list__app__right")

    const statusWrapper = document.createElement('div')
    statusWrapper.setAttribute("class", "status_wrapper")
    for(var index in installStatus[apkType]) {
        let status = installStatus[apkType][index]

        const statusItem = document.createElement('p')
        statusItem.setAttribute('class', `status ${status}`)
        statusItem.setAttribute('data-index', index)
        statusItem.innerHTML = parseInt(index) === 0 ? `${formatBytes(apk_total_size)}` : status
        if(status === 'Error') {
            statusItem.onclick = (e) => show_error(e, data_id)
            // statusItem.innerHTML = `${status} <span class = "exclamation_icon">${exclamation}</span>`
        }
        statusWrapper.append(statusItem)
    }

    const errorContent = document.createElement('span')
    errorContent.className = `${data_id} error_content`

    const errorDetails = document.createElement('span')
    errorDetails.className = 'error_details' 

    const errorActions = document.createElement('span')
    errorActions.className = 'error_actions' 

    const close_error_box_btn = document.createElement('button');
    close_error_box_btn.className = "close_error_box"
    close_error_box_btn.innerHTML = 'Close'
    close_error_box_btn.onclick = (e) => close_report(e, data_id)
    
    const error_report_btn_btn = document.createElement('button');
    error_report_btn_btn.className = "error_report_btn"
    error_report_btn_btn.innerHTML = 'Report'
    error_report_btn_btn.onclick = () => report_error(data_id)

    errorActions.append(error_report_btn_btn)
    errorActions.append(close_error_box_btn)

    rightDiv.append(statusWrapper)

    errorContent.append(errorDetails)
    errorContent.append(errorActions)
    appContents.append(errorContent)

    appContents.append(appSelected)
    appContents.append(leftDiv)
    appContents.append(rightDiv)

    appHTML.append(appBorder)
    appHTML.append(appContents)

    if(append_if_not_exist) {
        if(![...document.querySelectorAll('.mainWindow__center__apps_list__app.main-item')].map(c => c.getAttribute('data-path')).includes(appHTML.getAttribute('data-path'))) {
            container.insertBefore(appHTML, container.children[0])
        }
    } else {
        container.insertBefore(appHTML, container.children[0])
    }

    if(container.children && container.children.length > 0) {
        container.classList.add('has_apps');
    } else {
        container.classList.remove('has_apps');
    }

    document.querySelector(`.app_name_${formatted_path}`).innerHTML = shorthanded_name
    document.querySelector(`.app_type_${formatted_path}`).innerHTML = simpleApkType
    document.querySelector(`.app_more_info__version_${formatted_path}`).innerHTML = `${apk_version_name}`
    
    isUrl(apk_icon) ? 
        document.querySelector(`.app_logo_${formatted_path}`).src = apk_icon :
        document.querySelector(`.app_logo_${formatted_path}`).src = `data:image/png;base64,${apk_icon}`
    
    if(!searchResult) {
        keep_in_current_Apps(apk_name, apk_path)
    }
    // console.log("current", currentApps, window.localStorage.getItem('currentApps'))
    // storage.clear()
    // console.log("data_id", data_id)
    // get_data('current')
    //     .then(jsonData => {
    //         // console.log("--<", jsonData, )
    //         let new_data = [...jsonData, data_id];
    //         // console.log("new_data", [...new Set(new_data)])
    //         save_data("current", [...new Set(new_data)])
    // })
    // read_temp_file("current.json")
    // .then(data => {
    //     // console.log("read_temp_file", data)
    //     var unique_data = [...new Set(data)]
    //     save_data_to_local("current", JSON.stringify(unique_data))
    // })
    // storage.get('current', function(_, data) {
    //     console.log("data", data)
    //     let apps_in_storage = data.length !== undefined ? data : []
    //     apps_in_storage.push(data_id)
    //     storage.set("current", [...new Set(apps_in_storage)])
    // })
    
    // storage.getAll(function(error, data) {
    //     if (error) throw error;
    //     console.log("data", data);
    // });
}

function get_apk_min_sdk_version(raw_file) {
    console.log('get_apk_min_sdk_version')
    try {
        return JSON.parse(`{${raw_file.substring(raw_file.indexOf('minSdkVersion') - 1, raw_file.indexOf('}', raw_file.indexOf('minSdkVersion')))}}`).minSdkVersion
    } catch {
        return false
    }
}
async function get_apk_info(apk_path) {
    console.log('get_apk_info')
    // if(!fs.existsSync(apk_path)) {
    //     return
    // }
    const apk = new Apk(apk_path);
    const apkManifest = await apk.getManifestInfo();
    const raw_file  = JSON.stringify( apkManifest.raw)
    const apkResoures = await apk.getResources();
    let icon_1 = false;
    let icon_2 = false;
    let icon_3 = false;
    let apk_name = path.basename(apk_path)
    var formatted_path = get_escaped_path(apk_path)
    icon_1 = await get_app_icon_1(apk, apkManifest, apkResoures)

    if(icon_1) icon_1 = icon_1.toString('base64')

    if(!icon_1) {
        icon_2 = await get_app_icon_2(apk_path)
    }
    if(!icon_1 && !icon_2) {
        icon_3 = await get_app_icon_3(apkManifest.package)
    }
   
    let label = get_app_label(apk_name, apkResoures,apkManifest);
    
    // let label = apk_name.split('.').at(0);
    let package = apkManifest.package;
    let versionCode = apkManifest.versionCode;
    let versionName = apkManifest.versionName;
    var apkSize = fs.statSync(apk_path).size;
    let min_sdk_version = get_apk_min_sdk_version(raw_file)
    // console.log("apk --> ", apk_path, raw_file, min_sdk_version)
    let icon = icon_1 || icon_2 || icon_3  
    console.log('icon', icon)
    console.log('icon_1', icon_1)
    console.log('icon_2', icon_2)
    console.log('icon_3', icon_3)
    const apk_Info = {
        apk_name: label,
        apk_package_name: package,
        apk_total_size: apkSize,
        apk_version_code: versionCode,
        apk_version_name: versionName,
        apk_icon: icon,
        min_sdk_version
    }
    save_data(formatted_path, apk_Info, apk_path)
    apk.close();
    return apk_Info
}

function get_key_for_apk(package = "", versionName = "", versionCode = "", apk_name = "") {
    
    console.log('get_key_for_apk')
    return escape_specials(`${package}_${versionName}_${versionCode}_${apk_name}`, keepInStorage = false)
}

function get_random_num() { return Math.floor(Math.random() * 10) }

function escape_specials(name, keepInStorage = true) {
    console.log('escape_specials')
    var escaped = String(name).replace(/[^0-9a-zA-z]/g, String(get_random_num())).replace(/\\/g, String(get_random_num()));
    
    if(keepInStorage) {
        window.localStorage.setItem(name, escaped)
        window.localStorage.setItem(escaped, name )
    }

    return escaped
}
const convert = (imgPath) => {
    // read image file
    return new Promise((resolve, reject) => {
        fs.readFile(imgPath, (err, data)=>{
            // error handle
            if(err) {
                reject(err) ;
            }
            
            // get image file extension name
            const extensionName = path.extname(imgPath);
            
            // convert image file to base64-encoded string
            const base64Image = Buffer.from(data, 'binary').toString('base64');
            resolve(base64Image)
            // combine all strings
            const base64ImageStr = `data:image/${extensionName.split('.').pop()};base64,${base64Image}`;
        })
    })
}
async function get_xapk_info(apk_path) {
    return new Promise((resolve) => {
        var formatted_path = get_escaped_path(apk_path)
        const temp_dir_path = path.join(tmpPath, get_app_label(path.basename(apk_path)))
        const extractXapk = spawn('7z', ['e', apk_path, 'icon.png', 'manifest.json', '-r', '-y', `-o${temp_dir_path}`])

        extractXapk.on('close', async () => {
            const data = fs.readFileSync(path.join(temp_dir_path, 'manifest.json'),  {encoding:'utf8', flag:'r'})
            const { expansions, split_apks, min_sdk_version, package_name, total_size, version_code, version_name, icon} = JSON.parse(data);

            const iconBuffer = await convert(path.join(temp_dir_path, icon))
            let label = get_app_label(path.basename(apk_path))
            
            const xapk_Info = {
                apk_name: label,
                apk_package_name: package_name,
                apk_total_size: total_size,
                apk_version_code: version_code,
                apk_version_name: version_name,
                apk_icon: iconBuffer,
                min_sdk_version,
                split_apks,
                expansions
            }
            save_data(formatted_path, xapk_Info, apk_path)
            // add_apk_to_html(apk_path, xapk_Info, folder_path, keepInStorage)
            
            resolve(xapk_Info) 

            // fs.readFile(, (_, data) => {
            
            // })
        })


    })
}


async function folder_clicked(folder_path, status) {
    console.log('folder_clicked')
    // console.log("window.localStorage.getItem(folder_path)", window.localStorage.getItem(folder_path), folder_path)
    document.querySelector(`.${window.localStorage.getItem(folder_path)}`).classList.toggle('active');
    const removed_apps = JSON.parse(window.sessionStorage.getItem('removed_apps')) || []
    
    for(let ra of removed_apps) {
        // console.log("ra ->", path.basename(window.localStorage.getItem(ra)), path.dirname(window.localStorage.getItem(ra)), get_active_folders(), folder_path)
        if(get_active_folders().includes(window.localStorage.getItem(path.dirname(window.localStorage.getItem(ra)))) && path.dirname(window.localStorage.getItem(ra)) !== folder_path) {
            add_apk_to_html(
                window.localStorage.getItem(ra),
                ra,
                get_data(ra),
                path.dirname(window.localStorage.getItem(ra)),
                false,
                true
            )
        }
    }

    if(status === 'active') {
        remove_search_result_items() 
        // console.log("folder_path", folder_path)
        // const clicked_folder = document.querySelector()
        // const unescaped_path = window.localStorage.getItem(clicked_folder.getAttribute('data-id'));
        await add_apks_from_folder(folder_path) 
        // const active_folders = document.querySelectorAll(".mainWindow__left__folders_list_folder.active")
        // // console.log("active_folders", active_folders)
        // remove_apps()
        // for(f of active_folders) {
            
        // }
        // document.querySelectorAll('.mainWindow__left__folders_list_folder').forEach(f => f.style.pointerEvents = "auto")
    } else if(status === 'unactive') {
         const apks_of_folders = document.querySelectorAll(`[data-parent=${window.localStorage.getItem(folder_path)}].main-item`)
        console.log("apks_of_folders", apks_of_folders)
         apks_of_folders.forEach(a => {
            a.remove();
            apps_count_status(increase = false);
        })
    }

    change_selectAll_deselectAll_status(is_all_apps_selected())
    console.log("get_active_folders()", get_active_folders())
    get_active_folders().length > 1 ?
        document.querySelectorAll('.mainWindow__center__apps_list__app ').forEach(app => app.classList.add('show_path')) :
        document.querySelectorAll('.mainWindow__center__apps_list__app ').forEach(app => app.classList.remove('show_path'))
}
// let can_click = true
// function folder_clicked(folder_path) {{
//     folder_clicked_call(folder_path)
    // document.querySelectorAll('.mainWindow__left__folders_list_folder').forEach(f => f.style.pointerEvents = "none")
    // console.log("-----> folder_clicked", can_click)
    // setTimeout(() => {
    //     can_click = true
    //     // folder_clicked_call()
    // }, 500)
    // if(!can_click) { return }
    // folder_clicked_call()
    // can_click = false
    
    // document.querySelectorAll('.mainWindow__left__folders_list_folder').forEach(f => f.style.pointerEvents = "auto")
    // add_apks_from_folder
    // let other_folder_apps = all_apps.map(a => {if(!folder_apps.includes(a)) {all_apps.splice(all_apps.indexOf(a), 1)}})
    // console.log("-->", all_apps.map(a => {if(!folder_apps.includes(a)) {return a} else {return false}}))
    // apps.map(a => {
    //     if(all_apps.includes(a)) {
    //         // console.log("a", a)
    //         // document.querySelector(`[data-id=${a}]`).remove()
    //         all_apps.splice(all_apps.indexOf(a), 1)
    //     }
    // })
    // console.log('other_folder_apps -> ', other_folder_apps)
    // all_apps.forEach(a => {
    //     // console.log("a", a.getAttribute('data-id'), apps.includes(a.getAttribute('data-id')))
    //     if(!apps.includes(a.getAttribute('data-id'))) {
    //         a.remove()
    //     } else {
    //         const apks = listdir(folder_path);
    //         for(a of apks) {
    //             const apk_path = path.join(folder_path, a);
                
    //             const apk = new Apk(apk_path)
    //             let a_list = []
    //             if(a.split('.').at(-1) == 'apk') {
    //                 apk.getManifestInfo().then(manifest => {
    //                     let {package, versionName, versionCode} = manifest;
    //                     var apk_key = `${package}_${versionName + versionCode}`
    //                     a_list.push({apk_key, apk_path, folder_path })
    //                 })
    //             } else {
                    
    //                 const zip = new StreamZip.async({ file: apk_path });
    //                 zip.entryData('manifest.json').then(manifestData => {
    //                     let { package_name, version_code, version_name} = JSON.parse(manifestData)
    //                     var apk_key = `${package_name}_${version_name + version_code}`
    //                     a_list.push({apk_key, apk_path, folder_path })
                        
    //                 });
    //             }
    //             get_apps_from_storage(a_list)
    //         }
    //     }
    // })

    // console.log("apps", apps)
// }}

function removeFolder(escaped_folder_path) {
    console.log('removeFolder')
    // // const folder_list = document.querySelector('mainWindow__left__folders_list_folder')
    const folder = document.querySelector(`[data-id=${escaped_folder_path}]`)
    const container = document.querySelector('.mainWindow__center__apps_list');
    let currentApps = window.sessionStorage.getItem('currentApps') || []
    currentApps = JSON.parse(currentApps)
    
    const apks_of_folders = currentApps.filter(ca => path.dirname(Object.values(ca).toString()) == window.localStorage.getItem(escaped_folder_path)) 

    apks_of_folders.map(fa => {
        var apk_path = Object.values(fa)
        const apk_element = document.querySelector(`[data-path=${window.localStorage.getItem(apk_path)}]`)
        if(apk_element) { apk_element.remove() }
        if(selected_apps.includes(apk_element)) {selected_apps.splice(selected_apps.indexOf(apk_element), 1)}

        changeSelectedAppStatus()
        apps_count_status(increase = false);
        
        currentApps.slice(fa, 1)
    })
    window.sessionStorage.setItem("currentApps", JSON.stringify(currentApps))

    folder.remove()
    if(container.children && container.children.length > 0) {
        container.classList.add('has_apps');
    } else {
        container.classList.remove('has_apps');
    }
}

function pinFolder(escaped_folder_path)  {
    console.log('pinFolder')
    const folder = document.querySelector(`[data-id=${escaped_folder_path}]`)
    folder.classList.toggle('pinned')
    
    const pinedFolders = JSON.parse( window.localStorage.getItem('pinedFolders')) || []
    console.log("pinedFolders", pinedFolders)
    folder.classList.contains('pinned') ? pinedFolders.push(escaped_folder_path) : pinedFolders.splice(pinedFolders.indexOf(escaped_folder_path), 1)
    window.localStorage.setItem("pinedFolders", JSON.stringify([...new Set(pinedFolders)]))
}

const folderIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon main_svg" viewBox="0 0 1024 1024" version="1.1">
            <path d="M183.232 128c0 0-52.544 0 37.184 0 80.448 0 164.288 0 250.368 0 58.368 0 58.24 128.832 140.864 128.832 50.88 0 228.992 0 228.992 0C906.56 256.832 960 310.272 960 376.128l0 398.656c0 65.856-53.44 119.232-119.296 119.232L183.232 894.016C117.44 894.08 64 840.704 64 774.784L64 247.296C64 181.376 117.44 128 183.232 128z"/>
        </svg>
`

const pinIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M31.997334 1023.957337a31.698692 31.698692 0 0 1-22.611449-9.385885c-6.058162-6.015499-9.385885-14.078827-9.385885-22.611449s3.327723-16.59595 9.385885-22.611449l318.864094-318.864094-152.520623-152.520624a95.906674 95.906674 0 0 1-25.08591-92.15232A95.309391 95.309391 0 0 1 194.970419 347.192401l0.895925-0.511958A353.463878 353.463878 0 0 1 372.022331 299.281727c20.136989 0 40.359303 1.749188 60.282977 5.204899l165.404883-259.946338A95.224065 95.224065 0 0 1 678.684776 0.085326c25.64053 0 49.745188 9.983168 67.877011 28.072328l249.195233 249.195233a95.224065 95.224065 0 0 1 25.896509 88.739272 95.138738 95.138738 0 0 1-42.151154 60.154987l-259.989001 165.447546a352.226648 352.226648 0 0 1-42.663112 237.292226 95.394717 95.394717 0 0 1-82.851762 47.526706 95.522706 95.522706 0 0 1-67.962336-28.200317l-152.60595-152.605949-318.821431 318.906757a31.912007 31.912007 0 0 1-22.611449 9.343222zM372.022331 363.276394c-50.641113 0-100.684943 13.566869-144.7986 39.207399a31.570702 31.570702 0 0 0-14.67611 19.497042 31.698692 31.698692 0 0 0 8.36197 30.674777l350.434797 350.434797c6.058162 6.058162 14.12149 9.385885 22.696775 9.385885a31.698692 31.698692 0 0 0 27.56037-15.785352 287.421382 287.421382 0 0 0 31.058745-212.67561 31.997334 31.997334 0 0 1 13.908175-34.471794l278.590117-177.265228a31.570702 31.570702 0 0 0 14.036164-20.051662 31.698692 31.698692 0 0 0-8.617949-29.565536L701.296225 73.380552a31.912007 31.912007 0 0 0-49.617198 5.418215l-177.307891 278.590117a31.826681 31.826681 0 0 1-34.471794 13.908175 293.778185 293.778185 0 0 0-67.877011-8.020665z"/>
    </svg>
`

const closeIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M945.930435 893.864104 556.382325 510.921435l381.169279-391.296941c12.443403-12.757558 12.218276-33.217543-0.49221-45.705971-12.688997-12.487406-33.062-12.263301-45.480844 0.494257L510.399037 465.718931 120.843764 82.768075c-12.691043-12.487406-33.062-12.263301-45.481867 0.494257-12.419867 12.735046-12.195763 33.217543 0.494257 45.683459l389.553227 382.958018L84.231915 903.207913c-12.443403 12.756535-12.217253 33.216519 0.494257 45.705971 6.356778 6.243191 14.622022 9.29776 22.841218 9.208732 8.243755-0.091074 16.418948-3.325745 22.64065-9.702989l381.182582-391.310244L900.942825 940.065356c6.333242 6.242168 14.600533 9.320273 22.840194 9.229199 8.222265-0.088004 16.419971-3.346211 22.64065-9.723455C958.844559 926.811494 958.641945 906.35151 945.930435 893.864104z"/>
    </svg>
`

const maximizedIcon =  `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1157 1024" version="1.1">
        <path d="M1016.522 724.44H833.874v236.781h-61.532v-1.168H124.311v1.168H62.779v-662.44h236.002V62.779h779.273v661.662h-61.532zM124.311 898.521h648.031V360.313H124.311v538.208z m892.211-774.21h-656.21v174.47h473.561v364.128h182.648V124.311z"/>
    </svg>
`

const exclamation = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M443.72992 750.92992c0-37.66272 30.5664-68.25984 68.27008-68.25984s68.27008 30.59712 68.27008 68.25984a68.27008 68.27008 0 0 1-136.54016 0zM546.12992 614.4h-68.25984l-34.14016-409.6h136.54016z"/>
    </svg>
`

const restoredIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M853.504 170.496v682.496H170.496V170.496h683.008m4.096-64h-691.2c-32.768 0-59.392 26.624-59.392 59.392v691.712c0 32.768 26.624 59.392 59.392 59.392h691.712c32.768 0 59.392-26.624 59.392-59.392v-691.2c0-33.28-26.624-59.904-59.904-59.904 0.512 0 0 0 0 0z"/>
    </svg>
`
const lineCheckedIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M464.248 677.488c9.967 9.161 25.418 8.714 34.838-1.009l299.819-309.441c9.598-9.906 9.349-25.718-0.558-35.317-9.906-9.598-25.718-9.348-35.316 0.558L463.21 641.72l34.84-1.008L316.608 473.94c-10.156-9.334-25.955-8.668-35.29 1.487-9.334 10.156-8.668 25.955 1.487 35.29l181.442 166.77z"/>

    </svg>
`
const down_arrow = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path xmlns="http://www.w3.org/2000/svg" d="M1005.9 333L576 762.9c-17.3 17.3-40.2 26.7-64.7 26.7s-47.4-9.5-64.7-26.7L16.8 333c-22.3-22.3-22.3-58.5 0-80.8 22.3-22.3 58.5-22.3 80.8 0l413.8 413.7 413.8-413.8c22.3-22.3 58.5-22.3 80.8 0 11.2 11.2 16.7 25.8 16.7 40.5-0.1 14.6-5.6 29.2-16.8 40.4z m0 0" fill=""/>                                
    </svg>
`

const up_arrow = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M1005.9 691c11.2 11.2 16.7 25.8 16.7 40.5 0 14.6-5.5 29.3-16.7 40.5-22.3 22.3-58.5 22.3-80.8 0L511.4 358.1 97.6 771.7c-22.3 22.3-58.5 22.3-80.8 0-22.3-22.3-22.3-58.5 0-80.8L446.7 261c17.3-17.3 40.2-26.7 64.7-26.7s47.4 9.5 64.7 26.7l429.8 430z m0 0" fill=""/>
    </svg>
`

const left_arrow = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M706.2 958.6c-15 0-30.1-5.7-41.5-17.2L277.1 553.8c-22.9-22.9-22.9-60.1 0-83L664.7 83.2c22.9-22.9 60.1-22.9 83 0s22.9 60.1 0 83l-346 346 346 346c22.9 22.9 22.9 60.1 0 83-11.4 11.6-26.5 17.4-41.5 17.4z"/>
    </svg>
`

const right_arrow = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M779.180132 473.232045 322.354755 16.406668c-21.413706-21.413706-56.121182-21.413706-77.534887 0-21.413706 21.413706-21.413706 56.122205 0 77.534887l418.057421 418.057421L244.819868 930.057421c-21.413706 21.413706-21.413706 56.122205 0 77.534887 10.706853 10.706853 24.759917 16.059767 38.767955 16.059767s28.061103-5.353938 38.767955-16.059767L779.180132 550.767955C800.593837 529.35425 800.593837 494.64575 779.180132 473.232045z"/>
    </svg>
`
const checkedIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon main_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M426.666667 725.333333l-213.333334-213.333333 60.16-60.586667L426.666667 604.586667l323.84-323.84L810.666667 341.333333m0-213.333333H213.333333c-47.36 0-85.333333 37.973333-85.333333 85.333333v597.333334a85.333333 85.333333 0 0 0 85.333333 85.333333h597.333334a85.333333 85.333333 0 0 0 85.333333-85.333333V213.333333a85.333333 85.333333 0 0 0-85.333333-85.333333z" fill=""/>
    </svg>
`

const minus = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M810.666667 554.666667H213.333333a42.666667 42.666667 0 0 1 0-85.333334h597.333334a42.666667 42.666667 0 0 1 0 85.333334z"/>
    </svg>
`

const uncheckedIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon main_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M227.487 892.447c-50.919 0-92.345-41.426-92.345-92.345V222.49c0-50.14 40.791-90.932 90.932-90.932h573.291c49.347 0 89.493 40.146 89.493 89.493V801.9c0 49.925-40.622 90.547-90.548 90.547H227.487z m11.197-706.74c-27.233 0-49.387 22.155-49.387 49.388v552.817c0 27.78 22.6 50.38 50.38 50.38h546.08c26.992 0 48.957-21.96 48.957-48.957V235.254c0-27.32-22.226-49.546-49.547-49.546H238.684z"/>
    </svg>
`

const searchIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
        <path d="M192 480a256 256 0 1 1 512 0 256 256 0 0 1-512 0m631.776 362.496l-143.2-143.168A318.464 318.464 0 0 0 768 480c0-176.736-143.264-320-320-320S128 303.264 128 480s143.264 320 320 320a318.016 318.016 0 0 0 184.16-58.592l146.336 146.368c12.512 12.48 32.768 12.48 45.28 0 12.48-12.512 12.48-32.768 0-45.28"/>
    </svg>
`

const loadingIcon =   `<span class = "loader main_svg"></span>`

function get_escaped_path(path) {
    console.log('get_escaped_path')
    // Check in storage, if not return new one
    return  window.localStorage.getItem(path) !== null ? window.localStorage.getItem(path) : escape_specials(path)
}
function show_full_folder_name(folder_name, show) {
    if(folder_name.classList.contains('shorthanded')) {
        // show ?
        if(show) {
            let full_name_span = document.createElement('span')
            full_name_span.className = "full_name_span"
            const rect = folder_name.getBoundingClientRect()
            full_name_span.innerHTML = folder_name.getAttribute('data-full_name')
            Object.assign(full_name_span.style , {
                position: 'absolute',
                borderRadius: '3px',
                top: `${rect.top}px`,
                left: `${rect.left}px`,
                height: `${rect.height}px`,
                background: '#1d1d1d',  // gray color 4
                padding: '0 3px'
            })

            document.querySelector('.window').append(full_name_span)
            console.log('rect', rect)
        } else {
            document.querySelectorAll('.full_name_span').forEach(s => s.remove())
        }
    }
}
function add_folder_to_html(folder_name, folder_path, active, pinned = "") {
    let escaped_folder_path = get_escaped_path(folder_path)
    const {shorthanded_name, shorthanded} = shorthand_long_Name(escaped_folder_path, folder_name, 'shorthand_folderNames', 15, 22)
    const folder_container = document.querySelector(".mainWindow__left__folders_list");
    const folder = document.createElement("div");
    folder.className = `mainWindow__left__folders_list_folder ${escaped_folder_path} ${active ? "active" : " "} ${pinned}`;
    folder.setAttribute("data-id", escaped_folder_path)
    
    const folder_left = document.createElement('div');
    folder_left.className = 'mainWindow__left__folders_list_folder__left';
    folder_left.onclick = () => folder_clicked(folder_path, document.querySelector(`[data-id=${escaped_folder_path}]`).classList.contains('active') ? "unactive" : "active")  

    folder_left.innerHTML = `
        <span class = "folder_icon">
            ${folderIcon}
        </span>
        <p class = ${shorthanded ? "shorthanded" : ""} data-full_name = "${folder_name}" onmouseenter="show_full_folder_name(this, true)" onmouseleave="show_full_folder_name(this, false)">${shorthanded_name}</p>
    `

    const folder_center = document.createElement('div');
    folder_center.className = 'mainWindow__left__folders_list_folder__center';
    folder_center.innerHTML =  ''

    const folder_right = document.createElement('div');
    folder_right.className = 'mainWindow__left__folders_list_folder__right';

    const folder_pinIcon = document.createElement('span');
    folder_pinIcon.className = "pinIcon folder_action_icon";
    folder_pinIcon.setAttribute('data-tooltip', 'Pin Folder')
    folder_pinIcon.setAttribute('data-tooltip_position', 'left')
    
    folder_pinIcon.innerHTML = pinIcon
    folder_pinIcon.onclick = () => pinFolder(escaped_folder_path)  
    folder_pinIcon.onmousemove = (event) => folder_action_icon_mouse_move(event)
    folder_pinIcon.onmouseleave = () => folder_action_icon_mouse_leave()

    const folder_closeIcon = document.createElement('span');
    folder_closeIcon.className = "closeIcon folder_action_icon";
    folder_closeIcon.setAttribute('data-tooltip', 'Remove Folder')
    folder_closeIcon.setAttribute('data-folder_id', escaped_folder_path)
    folder_closeIcon.setAttribute('data-tooltip_position', 'right')
    folder_closeIcon.innerHTML = closeIcon
    folder_closeIcon.onclick = () => removeFolder(escaped_folder_path)
    folder_closeIcon.onmousemove = (event) => folder_action_icon_mouse_move(event)
    folder_closeIcon.onmouseleave = () => folder_action_icon_mouse_leave()

    folder_right.append(folder_pinIcon)
    folder_right.append(folder_closeIcon)

    folder.append(folder_left)
    folder.append(folder_center)
    folder.append(folder_right)
    folder_container.insertBefore(folder, folder_container.children[0])
   
}

function apps_count_status(increase = true, label = 'Total Apps :  ', app_type = 'main-item', total_length = false) {
    
    console.log('apps_count_status')
    const currentTotal_apps = document.querySelectorAll(`.mainWindow__center__apps_list__app.${app_type}`).length
    if(!total_length) {
        increase ? currentTotal_apps + 1 : currentTotal_apps - 1
    }
    
    document.querySelector('.apps_counts_container .label').innerHTML = label
    document.querySelector('.apps_counts_container .apps').innerHTML = currentTotal_apps
}

async function add_apks_from_folder(active_dir, keepInStorage = false) {
    const apks = listdir(active_dir);
    const current_folder = document.querySelector(`[data-id=${window.localStorage.getItem(active_dir)}]`);
    console.log('apks', apks)
    current_folder.classList.add("disabled")
    const current_folder_center = current_folder.children.item(1);
    console.log("current_folder_center", current_folder_center)
    current_folder_center.innerHTML = `0/${apks.length}`;

    for (var apk of apks) {
        const apk_path = path.join(active_dir, apk);
        var formatted_path =get_escaped_path(apk_path)
        if(keepInStorage) { 
            keep_in_current_Apps(get_app_label(apk), apk_path)
        } else {
            let apk_extension = apk.split('.').at(-1);
            const data = get_data(window.localStorage.getItem(apk_path));
            // console.log("apk_path", apk_path, data)

            if(data && Object.keys(data).length > 0) {
                keep_in_current_temped(apk_path)
                add_apk_to_html(apk_path,formatted_path, data, active_dir)
                apps_count_status()
                continue
            }

            // If not old one
            if(apk_extension == 'apk') {
                add_apk_to_html(apk_path,formatted_path, await get_apk_info(apk_path), active_dir)
            } else if(apk_extension == "xapk") {
                console.log("xapk", apk_path, formatted_path, await get_xapk_info(apk_path))
                // console.log("formatted_path", formatted_path)
                // get_xapk_info(apk_path)
                add_apk_to_html(apk_path,formatted_path, await get_xapk_info(apk_path), active_dir)
            }
            apps_count_status()
            current_folder_center.innerHTML = `${apks.indexOf(apk) + 1}/${apks.length}`;
        }
    }

    current_folder_center.innerHTML = "";
    current_folder.classList.remove("disabled")
}

function show_apps_search_locations(obj) {
    console.log('show_apps_search_locations')
    obj.classList.toggle('show_dropdown')
    const apps_search_location__arrow = document.querySelector('.apps_search_location__arrow');

    obj.classList.contains('show_dropdown') ?
        apps_search_location__arrow.innerHTML = up_arrow:
        apps_search_location__arrow.innerHTML = down_arrow
}

async function apps_search_location_onclick (obj) {
    console.log('apps_search_location_onclick')
    await changeAppsSearchLocation(obj)
}

async function changeAppsSearchLocation(obj) {
    console.log('changeAppsSearchLocation')
    const new_location = obj.getAttribute('data-value')
    let location_names = {
        'current': 'Current Folder',
        'all': 'All Folders'
    }
    const apps_search_location = document.querySelector('.apps_search_location');
    const apps_search_location__value = document.querySelector('.apps_search_location__value');
    apps_search_location.setAttribute('data-value', new_location)
    apps_search_location__value.innerHTML = location_names[new_location]

    if(new_location === 'all') {
        const currentApps = window.sessionStorage.getItem('currentApps');
        const currentTemped = window.sessionStorage.getItem('currentTemped')
  
        if(new_location === 'all' && 
            currentApps &&
            currentTemped && 
            JSON.parse(currentApps).length > 0 && 
            JSON.parse(currentApps).length !== JSON.parse(currentTemped).length) {
                // If not apps are stored in temp folder, store them now for instance search ( indexing apps )
                const unTempedApps = JSON.parse(currentApps).filter(ca => !JSON.parse(currentTemped).includes( Object.values(ca).toString()))
                const search_bar_status_icon = document.querySelector('.search_bar_status_icon');
                const search_bar = document.querySelector("input[id='searchapps']")
                const search_bar_status_icon__indexing_apps = document.querySelector('.search_bar_status_icon__indexing_apps');

                let current_search_bar_value = search_bar.value

                search_bar_status_icon__indexing_apps.innerHTML =  `Indexing(0/${unTempedApps.length})`
                search_bar_status_icon__indexing_apps.classList.add('show');
                search_bar.disabled = true
                search_bar.classList.add('disabled')
                search_bar_status_icon.firstElementChild.innerHTML = loadingIcon 

                // unTempedApps.map(async(ua) =>
                for(var ua of unTempedApps) {
                    let apk_path = Object.values(ua)[0]
                    let existed_data = get_data(window.localStorage.getItem(apk_path));
                    console.log('existed_data', existed_data, apk_path, !Object.keys(existed_data).length > 0)
                    if(existed_data && Object.keys(existed_data).length > 0) {
                        keep_in_current_temped(apk_path)
                    } else {
                        const apk_name = Object.keys(ua).toString()
                        const apk_path = Object.values(ua).toString()
                        let apk_extension = path.basename(apk_path).split('.').at(-1);

                        search_bar.value = apk_name;
                        console.log("apk_path", apk_path)
                        if(apk_extension == 'apk') {
                        const e =  await get_apk_info(apk_path)
                        } else {
                            const e2 = await get_xapk_info(apk_path)
                        }
                    }
                    search_bar_status_icon__indexing_apps.innerHTML =  `Indexing(${unTempedApps.indexOf(ua) + 1}/${unTempedApps.length})`
                }

                search_bar_status_icon__indexing_apps.innerHTML = ""
                search_bar_status_icon__indexing_apps.classList.remove('show');
                search_bar.value = current_search_bar_value
                search_bar.disabled = false
                search_bar.classList.remove('disabled')
                search_bar_status_icon.firstElementChild.innerHTML = searchIcon 
                // console.log("loop end -----------------> ")
        }
    }
    // console.log("Seted ----------------------------> ")
}

function appsSearchBar_onkeyup(obj) {
    console.log('appsSearchBar_onkeyup')
    search_in_apps(obj)
}
async function search_in_apps(searchBar) {
    console.log('search_in_apps')
    let value = searchBar.value
    remove_apps()

    if(!value) { 
        for(let f of get_active_folders()) {
            await add_apks_from_folder(window.localStorage.getItem(f))
        }
        apps_count_status(total_length = true)

    } else {
        const apps_search_location = document.querySelector('.apps_search_location').getAttribute('data-value');
        var filtered_apps = JSON.parse(window.sessionStorage.getItem('currentApps')).
                                    filter(a => [...value.toLowerCase()].map(v => Object.keys(a).toString().toLowerCase().indexOf(v)).
                                    // sort().
                                    filter(i => i > -1).length == [...value].filter(f => f !== '‌').length)
        
        if(apps_search_location === 'current') {
            const current_active_folders = document.querySelectorAll('.mainWindow__left__folders_list_folder.active');
            filtered_apps = filtered_apps.filter(f => [...current_active_folders].map(c => c.getAttribute('data-id')).includes(window.localStorage.getItem(path.dirname(Object.values(f).toString()))))
            
        } 

        apps_count_status(increase = true, label = "Found :  ", app_type = 'search-item', total_length = true)
        console.log("filtered_apps", filtered_apps)
        for(fa of filtered_apps) {
            const apk_path = Object.values(fa).toString();
            if(!fs.existsSync(apk_path)) {
                continue
            }
            const folder_path = path.dirname(apk_path)
            let data = get_data(window.localStorage.getItem(apk_path))
            add_apk_to_html(apk_path, window.localStorage.getItem(apk_path), data, folder_path, searchResult = true)
            apps_count_status(increase = true, label = "Found :  ", app_type = 'search-item', total_length = true)
        }
    }
}

document.querySelector(".new_folder_btn").addEventListener("click", () => {
    ipc.send("selectFolders");
 });

function hide_or_show_apps(hide) {
    console.log('hide_or_show_apps')
    document.querySelectorAll(`.mainWindow__center__apps_list__app`).forEach(app => {
        Object.assign(app.style,{display: hide ? 'none' : 'flex'});
    })
} 
function remove_search_result_items() {
    console.log('remove_search_result_items')
    document.querySelectorAll(`.mainWindow__center__apps_list__app.search-item`).forEach(app => {
        app.remove()
    })
} 
function remove_apps() {
    console.log('remove_apps')
    const removed_apps = JSON.parse(window.sessionStorage.getItem("removed_apps")) || []
    document.querySelectorAll(`.mainWindow__center__apps_list__app`).forEach(app => {
        if(!removed_apps.includes(app.getAttribute('data-path'))) removed_apps.push(app.getAttribute('data-path'))
        app.remove()
    })
    console.log("------------->", removed_apps)
    window.sessionStorage.setItem("removed_apps", JSON.stringify(removed_apps))
}   

function download_app_update() { 
    ipc.send('download_app_update') 
}

function restart_app() { ipc.send('restart_app_update') }

ipc.on("app_version", (_, ver) => {
    console.log('app_Version------')
    document.querySelector('.app_version').innerHTML = `v ${ver}`
})
ipc.on("app_update", async (_, args) => {
    console.log('args', args)
    const key = Object.keys(args)[0];
    const value = Object.values(args)[0];
    console.log('key', key)
    console.log('value', value)
    const app_version = document.querySelector('.app_version');
    if(key === "update_avaiable") {
        app_version.innerHTML = `
        <span class = 'app_update_icon'>
            ${exclamation}
        </span>
        <span classs = "app_update_text">New update is available.</span>
        <button class = 'app_update_btn' onclick = 'download_app_update()'>
            Update
        </button>
        `
    } else if(key === 'update_in_download_progress') {
        var { percentage, total_size, transferred_size } = value;
        console.log('value', value, percentage, total_size, transferred_size)
        app_version.innerHTML = `
        <span class = 'app_update_icon'>
            <span class = "loader main_svg"></span>
        </span>
        <span class = 'app_update_text'>
            Updating
        </span>
        <span class = 'app_update_info'>
            ${formatBytes(transferred_size)}/${formatBytes(total_size)} ( <span class = 'percentage'>${Math.round(percentage)}%</span> )
        </span>
        `
    } else if(key === 'update_downloaded') {
        app_version.innerHTML = `
            <span class = 'app_update_icon updated'>
                ${lineCheckedIcon}
            </span>
            <span classs = "app_update_text">Updated</span>
            <button class = 'app_update_btn' onclick = 'restart_app()'>
                Restart Now
            </button>
        `
    } else if(key === 'update_preparing') {
        app_version.innerHTML = `
            <span class = 'app_update_icon'>
                <span class = "loader main_svg"></span>
            </span>
            <span classs = "app_update_text">Preparing to Update ...</span>
        `
    }

})
ipc.on("dirPaths", async (_, args) => {
    let active_dir = false
    const existed_dirs = [...document.querySelectorAll('.mainWindow__left__folders_list_folder')].map(f => f.getAttribute('data-id'))

    if(existed_dirs.length === 0) active_dir = args.at(-1)

    for(dir of args) {
        const folder_name =  path.basename(dir)
        if(!existed_dirs.includes(window.localStorage.getItem(dir))) { 
            add_folder_to_html(folder_name, dir, dir === active_dir ? "active" : "" )
        } 
        if(dir === active_dir) {
             add_apks_from_folder(active_dir)
        } 
        else { 
             add_apks_from_folder(dir, keepInStorage = true)
        }
        
    }
})

function add_installation_logs({serial_no, app_path, app_type, data, complete = false, cancelled = false, error = false}) {
    const installation_logs = document.querySelector(`.installation_logs__${serial_no}`);
    console.log('add_installation_logs ------------', `.installation_logs__${serial_no}`)
    // console.log("installation_logs", app_path, app_type, data, complete, cancelled, error)
    var app_name = get_app_label(path.basename(app_path))
    var escaped_app_path = `${window.localStorage.getItem(app_path)}`
    let max_length = 10;
    let div = document.querySelector(`.installation_logs__${serial_no} div.${escaped_app_path}`)
    console.log("div", div)
    let status = complete || cancelled || error;
    
    let statusIcons = {
        'complete': `
            <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
                <path d="M384 722.752l489.344-489.408a32 32 0 0 1 45.312 45.312l-512 512a32 32 0 0 1-45.312 0l-256-256a32 32 0 1 1 45.312-45.312L384 722.752z"/>
            </svg>
        `,

        'cancelled': `
            <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
                <path d="M872.615385 151.384615c-198.892308-198.892308-522.584615-198.892308-721.476923 0-198.892308 198.892308-198.892308 522.584615 0 721.476923 99.446154 99.446154 230.153846 149.169231 360.615384 149.169231S772.923077 972.307692 872.369231 872.861538c199.384615-199.138462 199.384615-522.584615 0.246154-721.476923z m-678.892308 42.338462C281.6 106.092308 396.8 62.030769 512 62.030769c105.846154 0 211.446154 37.415385 296.123077 111.507693L173.538462 807.876923c-154.584615-176.492308-148.184615-445.784615 20.184615-614.153846z m636.553846 636.553846c-168.369231 168.369231-437.661538 174.769231-614.4 20.184615L850.215385 216.123077c154.830769 176.492308 148.430769 445.784615-19.938462 614.153846z" fill="#2E323F"/>
            </svg>
                    
        `,
        'minus' : `
            <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
                <path d="M810.666667 554.666667H213.333333a42.666667 42.666667 0 0 1 0-85.333334h597.333334a42.666667 42.666667 0 0 1 0 85.333334z"/>
            </svg>
        `,
        'error' : `
            <svg xmlns="http://www.w3.org/2000/svg" class="svg-icon normal_svg" viewBox="0 0 1024 1024" version="1.1">
                <path d="M739.2 287c12.3 12.3 12.3 32.3 0 44.6L331.4 739.4c-12.3 12.3-32.3 12.3-44.6 0-12.3-12.3-12.3-32.3 0-44.6L694.6 287c12.3-12.3 32.3-12.3 44.6 0z" fill=""/><path d="M286.8 287c12.3-12.3 32.3-12.3 44.6 0l407.8 407.8c12.3 12.3 12.3 32.3 0 44.6-12.3 12.3-32.3 12.3-44.6 0L286.8 331.6c-12.3-12.3-12.3-32.3 0-44.6z" fill=""/>
            </svg>
        `

    }
    let statusTexts = {
        'complete' : 'is installed.',
        'error' : 'is not installed.',
        'cancelled': 'is cancelled.'
    }
    if(!div) {
        div = document.createElement('div');
        div.className = escaped_app_path
    }
    
    var log = `
        <p>
            <span class = "icon ${status ? status : ''}">${status ? statusIcons[status] : statusIcons['minus']}</span>
            ${status ?
                `
                    <span class = "app_name"> ${app_name.substr(0, max_length)} ${app_name.length > max_length ? "...": ""} </span> 
                    <span class = "other"> ${statusTexts[status]} </span>
                `
                :
                `
                    <span class = "other"> Installing </span>
                    <span class = "app_name"> ${app_name.substr(0, max_length)} ${app_name.length > max_length ? "...": ""} </span>
                    <span class = "apk_type">< ${app_type === 'apk' ? 'apk': 'xapk' } ></span>
                `
            }
        </p>
    `
    // console.log("log", log)
    let extra_log = ""

    if(app_type === 'obbapk') {
        extra_log = `
            <div class = "xapk_more_info">
                ${data && data.files !== undefined && data.current_file !== undefined ? 
                    `
                        <p>
                            <span class = "icon">${data.files === data.current_file ? statusIcons['complete'] : statusIcons['minus']}</span>
                            <span class = "other"> Extracting File${data.files > 1 ? "s": ""}
                                <span class = "currentBytotal">( ${data.current_file} / ${data.files} ) </span> 
                            </span>
                        </p>
                    `
                    : ''
                }
                ${data && data.total_obbs !== undefined && data.current_pushing_obb !== undefined ? 
                    `
                        <p>
                            <span class = "icon">${data.total_obbs === data.current_pushing_obb ? statusIcons['complete'] : statusIcons['minus']}</span>
                            <span class = "other"> Pushing OBB${data.total_obbs > 1 ? "s": ""}
                                <span class = "currentBytotal">( ${data.current_pushing_obb} / ${data.total_obbs} ) ${data.current_pushing_percent ? '<' + data.current_pushing_percent + '>': ""} </span> 
                            </span>
                        </p>
                    `
                    : ''
                }

                ${data && data.apks !== undefined && data.current_install_apk !== undefined ? 
                    `
                        <p>
                            <span class = "icon">${data.apks === data.current_install_apk ? statusIcons['complete'] : statusIcons['minus']}</span>
                            <span class = "other"> Installing Apk${data.apks > 1 ? "s": ""}
                                <span class = "currentBytotal">( ${data.current_install_apk} / ${data.apks} )</span> 
                            </span>
                        </p>
                    `
                    : ''
                }
            </div>
        `
    } else if(app_type === "splitapks") {
        extra_log = `
            <div class = "xapk_more_info">
                ${data && data.extract_apks !== undefined && data.current_extract_apk !== undefined ? 
                    `
                        <p>
                            <span class = "icon">${data.extract_apks === data.current_extract_apk ? statusIcons['complete'] : statusIcons['minus']}</span>
                            <span class = "other"> Extracting APKs 
                                <span class = "currentBytotal">( ${data.current_extract_apk} / ${data.extract_apks} )</span> 
                            </span>
                        </p>
                    `
                    : ''
                }
                ${data && data.install_apks !== undefined && data.current_install_apk !== undefined ? 
                    `
                        <p>
                            <span class = "icon">${data.install_apks === data.current_install_apk ? statusIcons['complete'] : statusIcons['minus']}</span>
                            <span class = "other"> Installing APKs 
                                <span class = "currentBytotal">( ${data.current_install_apk} / ${data.install_apks} )</span> 
                            </span>
                        </p>
                    `
                    : ''
                }
            </div>
        `
    }
    // console.log("extra_log", extra_log)
    // console.log("log + extra_log", log + extra_log)
    div.innerHTML = `
        ${log}
        ${extra_log}
    `
    installation_logs.insertBefore(div, installation_logs.children[0])

}


function install_apk(serial_no, apk_path, escaped_path, abortSignal, device_name) {
    console.log('install_apk')
    return new Promise((resolve, reject) => {
        const more_info = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .app_more_info`);
        more_info.classList.add('show_apk_size')

        app_install_status(escaped_path, 2)
        add_installation_logs({serial_no, app_path: apk_path, app_type: 'apk'})
        
        const install_process = spawn('./resources/adb_files/adb', ['-s', serial_no, 'install', '-r', apk_path], {signal: abortSignal})
        
        install_process.stdout.on('data', (data) => {
            console.log("apk install data => ", data.toString())
            // if(data.toString().trim() == 'Succes') {
            app_install_status(escaped_path, 3)
            add_installation_logs({serial_no, app_path: apk_path, app_type: 'apk', complete: 'complete'})
            setTimeout(() => resolve(true), 700)
            // } else {
            //     reject({err: `Success Message -> ${data.toString()}`, err_type: 'Error'})
            // }
        });

        
        install_process.stderr.on('data', (data) => {
            app_install_status(escaped_path, 6)
            add_installation_logs({serial_no, app_path: apk_path, app_type: 'apk', error: 'error'})
            reject({err: data.toString(), err_type: 'Error'})
        });

        install_process.on('error', (error) => {
            if(error.name === "AbortError") {
                app_install_status(escaped_path, 5)
                add_installation_logs({serial_no, app_path: apk_path, app_type: 'apk', cancelled: 'cancelled'})
                reject({err: error, err_type: 'AbortError'})
                return
            }
            app_install_status(escaped_path, 6)
            add_installation_logs({serial_no, app_path: apk_path, app_type: 'apk', error: 'error'})
            reject({err: error, err_type: 'Error'})
        // This will be called with err being an AbortError if the controller aborts
        });

        // abortSignal.addEventListener( 'abort', () => { // 6
        //     console.log("aborted in apk", install_process.pid)
        //     // install_process.kill()
        //     // process.kill(install_process.pid)
        //     // await fkill(install_process.pid);
        //     // execSync(`taskkill /F /PID ${install_process.pid}`)
        //     console.log('--->', install_process.killed)
        //     const error = new DOMException( 'Calculation aborted by the user', 'AbortError' );
        //     reject( error ); // 8
        // });
    })
}
function install_obbXapk(serial_no, split_apks, expansions, apk_package_name, data_path, escaped_path, abortSignal) {
    
    console.log('install_obbXapk')
    return new Promise(async(resolve, reject) => {
        const more_info = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .app_more_info`);
        more_info.classList.add('show_apk_size')

        app_install_status(escaped_path, 2)
        add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk'})

        let temp_dir_path = path.join(tmpPath, path.basename(data_path).split(".").at(0))
        let obb_install_path = false
        const files = [...expansions, ...split_apks];
        let currentExtractedFiles = 0
        let currentPushedObbs = 0
        let currentInstalledApks = 0
        //Create Temp Folder for files
        if (!fs.existsSync(temp_dir_path)){
            fs.mkdirSync(temp_dir_path);
        }
        
        const extract_files = files.map(f => {
            return new Promise((resolve, reject) => {
                let file_name = path.basename(f.file)
                if(!obb_install_path) {
                    obb_install_path = f && f.install_path && path.dirname(f.install_path)
                }
                let extracting = spawn('7z', ['e', data_path, file_name, '-r', '-y', `-o${temp_dir_path}`])
                extracting.on('close', (code) => {
                    if(code === 0) {
                        console.log('file Extracted', file_name)
                        currentExtractedFiles += 1
                        add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {files: files.length, current_file:  currentExtractedFiles}})
                        resolve(true)
                    }
                });
                extracting.stderr.on('data', (data) => {
                    console.error(`stderr: ${data.toString()}`);
                    reject({err: data.toString(), err_type: 'Error'})
                });

                extracting.on('error', (error) => {
                    if(error.name === "AbortError") {
                        reject({err: error, err_type: 'AbortError'})
                    }
                    reject({err: error, err_type: 'Error'})
                // This will be called with err being an AbortError if the controller aborts
                });
            })
        })
        await Promise.all(extract_files).catch(err => reject(err))

        const createTmpFolder = new Promise((resolve, reject) => {
            const create_dir = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'mkdir', `sdcard/${obb_install_path}`])
            create_dir.on('close', (code) => {
                if(code === 0) {
                    resolve(true)
                }
            })
        })
        await createTmpFolder.then(() =>    { 
            console.log('Folder Created')

            // Go to Pushing Obbs status
            app_install_status(escaped_path, 3)
            add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {files: files.length, current_file:  currentExtractedFiles, total_obbs: expansions.length, current_pushing_obb:  0}})
        })

        const pushing_obbs = expansions.map(obb => {
            return new Promise((resolve, reject) => {
                let { file, install_path } = obb
                let obb_name = path.basename(file)
                let temp_obb_path = path.join(temp_dir_path, obb_name)

                const pushing_process = spawn('./resources/adb_files/adb', ['-s', serial_no, 'push', temp_obb_path, `sdcard/${obb_install_path}/${obb_name}`], {signal: abortSignal})
                pushing_process.on('close', (code) => {
                    if(code === 0) {
                        console.log('obb PUshed', obb_name)
                        currentPushedObbs += 1
                        add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {
                                files: files.length, current_file: files.length,
                                total_obbs: expansions.length, 
                                current_pushing_obb: currentPushedObbs,
                                current_pushing_percent: '100%'
                            }})
                        resolve(true)
                    }
                });
                pushing_process.stderr.on('data', (data) => {
                    console.error(`stderr: ${data.toString()}`);
                    reject({err: data.toString(), err_type: 'Error'})
                  });
                pushing_process.stdout.on('data', (data) => {
                    console.log("data", data.toString(),  data.toString().substr(data.indexOf('[') + 1, data.indexOf(']') - 1).trim())
                    add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {files: files.length, current_file:  currentExtractedFiles, total_obbs: expansions.length, current_pushing_obb:  currentPushedObbs , current_pushing_percent: data.toString().substr(data.indexOf('[') + 1, data.indexOf(']') - 1).trim()}})
                });
                pushing_process.on('error', (error) => {
                   console.log("error pushing_process", error)
                   if(error.name === "AbortError") {
                       reject({err: error, err_type: 'AbortError'})
                       return
                   }
                   reject({err: error, err_type: 'Error'})
                // This will be called with err being an AbortError if the controller aborts
                });

            })
        })
        await Promise.all(pushing_obbs).then(() => {
            app_install_status(escaped_path, 4)
            add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {files: files.length, current_file:  currentExtractedFiles, total_obbs: expansions.length, current_pushing_obb:  currentPushedObbs, apks: split_apks.length, current_install_apk: 0}})
        }).catch(err => reject(err))

        const install_apks = split_apks.map(apk => {
            return new Promise((resolve, reject) => {
                const apk_name = apk.file
                const temp_apk_folder = path.join(temp_dir_path, apk_name)

                const installing_process = spawn('./resources/adb_files/adb', ['-s', serial_no, 'install', '-r', temp_apk_folder], {signal: abortSignal})
                installing_process.on('close', (code) => {
                    if(code === 0) {
                        currentInstalledApks += 1
                        console.log('app installed', apk_name)
                        add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', data: {files: files.length, current_file:  currentExtractedFiles, total_obbs: expansions.length, current_pushing_obb:  currentPushedObbs, apks: split_apks.length, current_install_apk: currentInstalledApks}})
                        resolve(true)
                    }
                });
                installing_process.stderr.on('data', (data) => {
                    console.error(`stderr: ${data.toString()}`);
                    reject({err: data.toString(), err_type: 'Error'})
                });
                
                installing_process.on('error', (error) => {
                   console.log("error installing_process", error)
                   if(error.name === "AbortError") {
                       reject({err: error, err_type: 'AbortError'})
                   }
                   reject({err: error, err_type: 'Error'})
                // This will be called with err being an AbortError if the controller aborts
                });
            })
        })

        await Promise.all(install_apks).catch(err => reject(err))

        // Check application is installed or not
        await new Promise((resolve, reject) => {
            const installed = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'list', 'packages', '-3', '|', 'grep', apk_package_name], {signal: abortSignal})
            installed.stdout.on('data', (data) => {
                console.log("installed", data)
                if(data) {
                    app_install_status(escaped_path, 5)
                    add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', complete: 'complete'})
                } else {
                    
                    app_install_status(escaped_path, 6)
                    add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', error: 'error'})
                }
                resolve(true)
            });
        })

        await new Promise((resolve, reject) => {
            fs.rm(temp_dir_path, { recursive: true, force: true }, () => {
                console.log("folder removed")
                setTimeout(() => resolve(true), 700)
            })
            // fs.rmSync(temp_dir_path, { recursive: true, force: true });
        }).then(() => resolve("Done"))
    })

}
async function install_splitApks(serial_no, split_apks, apk_package_name, apk_path , escaped_path, abortSignal) {
    console.log("install_splitApks")

    return new Promise(async (resolve, reject) => {
        const more_info = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .app_more_info`);
        more_info.classList.add('show_apk_size')
        
        app_install_status(escaped_path, 2)
        add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks'})
        let temp_dir_path = path.join(tmpPath, path.basename(apk_path).split(".").at(0))
        let apk_infos = {};
        let extracted_apks_count = 0
        let installed_apk_count = 0

        console.log("temp_dir_path", temp_dir_path)
        if (!fs.existsSync(temp_dir_path)){
            fs.mkdirSync(temp_dir_path);
        }

        app_install_status(escaped_path, 3)
        add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', data: {extract_apks: split_apks.length, current_extract_apk: 0}})

        const extract_apks = split_apks.map(f => {
            return new Promise((resolve, reject) => {
                let apk_name = f.file
                let temp_apk_path = `${temp_dir_path}/${apk_name}`
                console.log("f", apk_name, temp_apk_path)

                let extracting_app = spawn('7z', ['e', apk_path, apk_name, '-r', '-y', `-o${temp_dir_path}`], {signal: abortSignal})

                extracting_app.on('close', (code) => {
                    console.log("extracting_app close",  code)
                    if(code === 0) {
                        extracted_apks_count += 1
                        add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', data: {extract_apks: split_apks.length, current_extract_apk: extracted_apks_count}})
                        
                        fs.stat(temp_apk_path, (_, stats) => {
                            apk_infos[apk_name] = stats.size
                            resolve(true)
                        })
                    }
                });
                extracting_app.stderr.on('data', (data) => {
                    console.log("extracting_app stderr", data)
                    reject({err: data.toString(), err_type: 'Error'})
                });

                extracting_app.on('error', (error) => {
                    console.log("extracting_app error", error)
                    if(error.name === "AbortError") {
                        reject({err: error, err_type: 'AbortError'})
                    }
                    reject({err: error, err_type: 'Error'})
                // This will be called with err being an AbortError if the controller aborts
                });
            })
        })
        await Promise.all(extract_apks).then(() => console.log("All apks Extracted")).catch(err => reject(err))
        // var get_apks = new Promise((resolve) => {
        //     fs.readdir(temp_dir_path, (files) => {
        //         console.log("files", files)
        //         resolve(files)
        //     })
        // })
        // const apks = await get_apks
        var apks = fs.readdirSync(temp_dir_path);

        app_install_status(escaped_path, 4)
        add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', data: {extract_apks: split_apks.length, current_extract_apk: extracted_apks_count, install_apks: apks.length, current_install_apk: installed_apk_count}})

        let total_size_in_Bytes = Object.values(apk_infos).reduce((t, c) => t + parseInt(c), 0)

        let create_session = new Promise((resolve, reject) => {
            let create_session_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'install-create', '-S', total_size_in_Bytes], {signal: abortSignal})
            create_session_.stdout.on('data', (data) => {
                console.log('create_session_ stdout', data)
                var session_id = data.toString().match(/[0-9]/g).join("")
                resolve(session_id)
            });
            create_session_.on('error', (error) => {
                console.log('create_session_ error', error)
                if(error.name === "AbortError") {
                    reject({err: error, err_type: 'AbortError'})
                }
                reject({err: error, err_type: 'Error'})
            // This will be called with err being an AbortError if the controller aborts
            });
        })

        let session_id = await create_session.catch(err => reject(err))
        
        const install_apks = apks.map(apk => {
            return new Promise(async (resolve, reject) => {
                const apkPath = path.join(temp_dir_path, apk) 
                const apkSize = apk_infos[apk]
                // `adb -s ${serial_no} push "${apkPath}" /data/local/tmp`
                let push_apk = new Promise((resolve) => {
                    const push_apk_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'push', apkPath, '/data/local/tmp'], {signal: abortSignal})
                    push_apk_.on('close', () => {
                        console.log("push_apk_ close")
                        resolve(true) });
                    
                    push_apk_.stdout.on('data', (data) => {
                        console.log("push_apk_ data", data.toString())
                        // resolve(session_id)
                    });
                    push_apk_.stderr.on('data', (data) => {
                        console.log("push_apk_ stderr", data.toString())
                        reject({err: data.toString(), err_type: 'Error'})
                        // resolve(session_id)
                    });
                    push_apk_.on('error', (error) => {
                        console.log("push_apk_ error", error)
                        if(error.name === "AbortError") {
                            reject({err: error, err_type: 'AbortError'})
                        }
                        reject({err: error, err_type: 'Error'})
                    // This will be called with err being an AbortError if the controller aborts
                    });
                })
                await push_apk.catch(err => reject(err))

                let install_apk = new Promise((resolve, reject) => {
                    const install_apk_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'install-write', '-S', apkSize, session_id, apks.indexOf(apk), `'/data/local/tmp/${apk}'`], {signal: abortSignal})

                    install_apk_.on('error', (error) => {
                        console.log("error install_apk", error, error.name)
                        if(error.name === "AbortError") {
                            reject({err: error, err_type: 'AbortError'})
                        }
                        reject({err: error, err_type: 'Error'})
                    // This will be called with err being an AbortError if the controller aborts
                    });
                    install_apk_.stderr.on('data', (data) => {
                        console.log("stderr install_apk", data.toString())
                        reject({err:  data.toString(), err_type: 'Error'})
                        // resolve(session_id)
                    });
                    install_apk_.stdout.on('data', (data) => {
                        console.log("stdout install_apk - ", data.toString())
                        if(data.toString().includes("Success")) {
                            resolve(true)
                        } else {
                            reject({err:  data.toString(), err_type: 'Error'})
                        }
                        // resolve(session_id)
                    });
                })
                
                await install_apk.catch(err => reject(err))
                
                // shell rm /data/local/tmp/${apks[apk_index]}`
                let remove_tmp_apk_file = new Promise((resolve, reject) => {
                    const remove_tmp_apk_file_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'rm', `'/data/local/tmp/${apk}'`], {signal: abortSignal})
                    remove_tmp_apk_file_.on('close', (code) => {
                        console.log("close remove_tmp_apk_file_ - ", code)
                        if(code === 0) {
                            installed_apk_count += 1
                            add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', data: {extract_apks: split_apks.length, current_extract_apk: extracted_apks_count, install_apks: apks.length, current_install_apk: installed_apk_count}})
                            resolve(true)
                        }
                    });
                    remove_tmp_apk_file_.on('error', (error) => {
                        console.log("error remove_tmp_apk_file_ - ", error)
                        if(error.name === "AbortError") {
                            reject({err: error, err_type: 'AbortError'})
                        }
                        reject({err: error, err_type: 'Error'})
                    // This will be called with err being an AbortError if the controller aborts
                    });
                    remove_tmp_apk_file_.stderr.on('data', (data) => {
                        console.log("stderr remove_tmp_apk_file", data.toString())
                        reject({err: data.toString(), err_type: 'Error'})
                        // resolve(session_id)
                    });
                    remove_tmp_apk_file_.stdout.on('data', (data) => {
                        console.log("stdout remove_tmp_apk_file - ", data.toString())
                        // resolve(session_id)
                    });
                })
                
                await remove_tmp_apk_file.catch(err => reject(err))
                
                resolve(true)
            
            })
        })
        await Promise.all(install_apks).catch(err => reject(err))

        app_install_status(escaped_path, 9)

        // Commit session
        await new Promise((resolve, reject) => {
            const commit_session_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'install-commit', session_id], {signal: abortSignal})
            commit_session_.on('close', () => resolve(true));
            commit_session_.stderr.on('data', (data) => {
                console.log("data commit_session_ - ", data.toString())
                reject({err: data.toString(), err_type: 'Error'})
                // resolve(session_id)
            });
            commit_session_.on('error', (error) => {
                if(error.name === "AbortError") {
                    reject({err: error, err_type: 'AbortError'})
                }
                reject({err: error, err_type: 'Error'})
            // This will be called with err being an AbortError if the controller aborts
            });
        })

        //Abadon Session
        await new Promise((resolve, reject) => {
            const adadon_session_ = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'install-abandon', session_id], {signal: abortSignal})
            adadon_session_.on('close', (code) => {
                resolve(true)
            });
            adadon_session_.stderr.on('data', (data) => {
                console.log("data commit_session_ - ", data.toString())
                // reject({err: data.toString(), err_type: 'Error'})
                resolve(true)
                // resolve(session_id)
            });
            adadon_session_.on('error', (error) => {
                if(error.name === "AbortError") {
                    reject({err: error, err_type: 'AbortError'})
                }
                reject({err: error, err_type: 'Error'})
            // This will be called with err being an AbortError if the controller aborts
            });
        }).catch(err => reject(err))
        console.log("Check application is installed or not")
        // Check application is installed or not
        await new Promise((resolve, reject) => {
            const installed = spawn('./resources/adb_files/adb', ['-s', serial_no, 'shell', 'pm', 'list', 'packages', '-3', '|', 'grep', apk_package_name], {signal: abortSignal})
            installed.on('close', (code) => {
                console.log("Installed close", code)
                if(code === 0) {
                    resolve(true)
                } else {
                    reject({err: 'App installation fail with code ' + code, err_type: 'Error'})
                }
            })
            installed.stderr.on('data', (data) => {
                console.log("data installed - ", data.toString())
                reject({err: data.toString(), err_type: 'Error'})
                // resolve(session_id)
            });
            installed.stdout.on('data', (data) => {
                console.log("data stdout installed - ", data.toString())
                if(data) {
                    app_install_status(escaped_path, 5)
                    add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', complete: 'complete'})
                } else {
                    
                    app_install_status(escaped_path, 6)
                    add_installation_logs({serial_no, app_path: apk_path, app_type: 'splitapks', error: 'error'})
                }
                resolve(true)
                // resolve(session_id)
            });
            installed.on('error', (error) => {
                console.log("installed error", error)
                if(error.name === "AbortError") {
                    reject({err: error, err_type: 'AbortError'})
                }
                reject({err: error, err_type: 'Error'})
            // This will be called with err being an AbortError if the controller aborts
            });
        }).catch(err => reject(err))
        // removeTmpFolder
        await new Promise((resolve, reject) => {
            fs.rm(temp_dir_path, { recursive: true, force: true }, () => {
                console.log("folder removed")
                resolve(true)
            })
            // fs.rmSync(temp_dir_path, { recursive: true, force: true });
        }).then(() => resolve("Done"))

    })
}

function app_install_status(escaped_path, index) {
    console.log('app_install_status', escaped_path, index)
    const statusS = document.querySelectorAll(`[data-path=${escaped_path}] .status`);
    const wrapper = document.querySelector(`[data-path=${escaped_path}] .status_wrapper`)
    // const { currentTarget: target } = e;
    if(wrapper) {
        const { height: wrapper_height } = wrapper.getBoundingClientRect()

        statusS.forEach(status => {
            Object.assign(status.style, {
                // transition: index === 0  ? "none" :  "transform cubic-bezier(1,-0.5, 0.58, 1) 200ms" ,
                transform: `translateY(-${wrapper_height * index }px)`
            })
        })
    }
}

function sleep(delay) {
    var start = new Date().getTime();
    while (new Date().getTime() < start + delay);
}

let abortController = null; 
let error_type = 'Error'

async function apps_install_btn_onclick(install_btn) {
    console.log('apps_install_btn_oonclick')
    const devices = [...document.querySelectorAll('.mobile_device.selected')]

    if ( abortController ) {
        abortController.abort(); // 5
        abortController = null;
        install_btn.innerHTML = 'Install';
        return;
    }  

    install_btn.innerHTML = 'Cancel';
    abortController = new AbortController(); 
    const apps_list = document.querySelector('.mainWindow__center__apps_list');
    const select_all_btn = document.querySelector('.mainWindow__center__bottom__left');
    apps_list.classList.remove('blur_apps');
    apps_list.classList.remove('installing_done');

    apps_list.classList.add('blur_apps');
    select_all_btn.classList.add('in_installing_process')
    selected_apps.forEach(app => app_install_status( app.getAttribute('data-path'), 1))

    for(var device of devices) {
        const serial_no = device.getAttribute('data-serial_no')
        const device_name = device.getAttribute('data-name')
        console.log("===>", serial_no, device_name, selected_apps)
        for(app of selected_apps) {
            
            if(abortController) {
                app.classList.add('installing__')
                app.scrollIntoView({
                    behavior: "smooth" , // auto
                    block:  "center" ,
                    inline: "center" 
                });
            }
            // app.
            let escaped_path = app.getAttribute('data-path')
            let data_path = window.localStorage.getItem(escaped_path);
            let apk_type = path.extname(data_path);

            if(apk_type === '.apk') {
                if(abortController) {
                    await install_apk(serial_no, data_path, escaped_path, abortController.signal, device_name)
                    .catch((error) => {
                        console.log("error", error)
                        const {err, err_type} = error;
                        error_type = err_type
                        if(err_type === 'AbortError') {
                            abortController = null;
                            install_btn.innerHTML = 'Install';
                            select_all_btn.classList.remove('in_installing_process')
                        }
                        const error_details = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .error_details`)
                        error_details.innerHTML = err
                    })
                } else {
                    console.log('error_type', error_type)
                    if(error_type === 'AbortError') {
                        app_install_status(escaped_path, 5)
                    } else {
                        app_install_status(escaped_path, 6)
                    }
                }
            } else if(apk_type === '.xapk') {
                var { split_apks, expansions, apk_package_name } = get_data(escaped_path)
                
                if(expansions === undefined) {
                    // split_apks type 
                    if(abortController) {
                        await install_splitApks(serial_no, split_apks, apk_package_name, data_path, escaped_path, abortController.signal)
                            .catch((error) => {
                                console.log("Errr --------->", error)
                                const {err, err_type} = error;
                                error_type = err_type
                                if(err_type === 'AbortError') {
                                    abortController = null;
                                    install_btn.innerHTML = 'Install';
                                    select_all_btn.classList.remove('in_installing_process')
                                    app_install_status(escaped_path, 7)
                                    add_installation_logs({serial_no, app_path: data_path, app_type: 'splitapks', cancelled: 'cancelled'})
                                } else {
                                    
                                    app_install_status(escaped_path, 8)
                                    add_installation_logs({serial_no, app_path: data_path, app_type: 'splitapks', error: 'error'})
                            
                                }
                                const error_details = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .error_details`)
                                error_details.innerHTML = err})
                    } else {
                        console.log('error_type', error_type)
                        if(error_type === 'AbortError') {
                            app_install_status(escaped_path, 7)
                        } else {
                            app_install_status(escaped_path, 8)
                        }
                    }
                } else {
                    if(abortController) {
                        await install_obbXapk(serial_no, split_apks, expansions, apk_package_name, data_path, escaped_path, abortController.signal)
                        .catch((error) => {
                            console.log("obbXapk Error ---->", error)
                            const {err, err_type} = error;
                            error_type = err_type
                            if(err_type === 'AbortError') {
                                abortController = null;
                                install_btn.innerHTML = 'Install';
                                select_all_btn.classList.remove('in_installing_process')
                                app_install_status(escaped_path, 7)
                                add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', cancelled: 'cancelled'})
                            } else {
                                
                                app_install_status(escaped_path, 8)
                                add_installation_logs({serial_no, app_path: data_path, app_type: 'obbapk', error: 'error'})
                       
                            }
                            const error_details = document.querySelector(`[data-id=${app.getAttribute('data-id')}] .error_details`)
                            error_details.innerHTML = err })
                    } else {
                        console.log("obbXapk error_type ---->", error_type)
                        if(error_type === 'AbortError') {
                            app_install_status(escaped_path, 7)
                        } else {
                            app_install_status(escaped_path, 8)
                        }
                    }
                }
            }
            // try {
            //     if(apk_type === '.apk') {
            //         await install_apk(serial_no, data_path, escaped_path, abortController.signal)
            //     } 
            // } catch(error) {
            //     console.log("Canceledd", error)
            //     // alert( 'WHY DID YOU DO THAT?!' ); // 9
            // } finally { // 10
            //     console.log("finally", abortController)
            //     abortController = null;
            //     install_btn.innerText = 'Install';
            // }
        }
    }
    apps_list.classList.remove('blur_apps');
    apps_list.classList.add('installing_done');
    select_all_btn.classList.remove('in_installing_process')
    abortController = null;
    install_btn.innerHTML = 'Install';
}

function closeWindow() {  
    console.log('closeWindow')
    const pinedActiveFolders = document.querySelectorAll('.mainWindow__left__folders_list_folder.active.pinned')
    if(pinedActiveFolders) {
        const folder_names = [...pinedActiveFolders].map(f => f.getAttribute('data-id'))
        window.localStorage.setItem('selected_folders', JSON.stringify(folder_names))
    }
    ipc.send("close_window")
}

    
function minimizeWindow() { ipc.send("minimize_window")}
function resizeWindow() { ipc.send("resize_window")}

ipc.on("maximized", () => document.querySelector('.resizeIcon').innerHTML = maximizedIcon)
ipc.on("restored", () =>document.querySelector('.resizeIcon').innerHTML = restoredIcon)

function mobile_device_thumbnail(dev) {
    console.log('mobile_device_thumbnail')

    const devices = document.querySelectorAll('.mobile_device');
    const model_tabs = document.querySelectorAll(`.model_name_tab`);
    const device_model_tab = document.querySelector(`.model_name_tab[data-serial_no="${dev.getAttribute('data-serial_no')}"]`);
    devices.forEach(device => {
        device.classList.remove('current_showing')
        device.style.transform = `translateX(${- (dev.getAttribute('data-index') * 108)}%)`;
    })
    model_tabs.forEach(tab => {
        tab.classList.remove('current_showing_model')
        Object.assign(tab.style , { display: 'none', right: 'unset', left: 'unset'})
    })
    dev.classList.add('current_showing')
    device_model_tab.classList.add('current_showing_model')
    device_model_tab.style.position = 'relative'
    device_model_tab.style.display = 'flex'

    const previous_device = document.querySelector(`.mobile_device[data-index="${parseInt(dev.getAttribute('data-index')) - 1}"]`)
    const next_device = document.querySelector(`.mobile_device[data-index="${parseInt(dev.getAttribute('data-index')) + 1}"]`)

    if(previous_device) {
        const previous_device_model_tab = document.querySelector(`.model_name_tab[data-serial_no="${previous_device.getAttribute('data-serial_no')}"]`);
        let previous_device_model_tab_left_arrow_span = document.querySelector(`.model_name_tab[data-serial_no="${previous_device.getAttribute('data-serial_no')}"] .left_arrow_span`);
        let previous_device_model_tab_right_arrow_span = document.querySelector(`.model_name_tab[data-serial_no="${previous_device.getAttribute('data-serial_no')}"] .right_arrow_span`);

        
        previous_device_model_tab.style.display = 'flex'
        previous_device_model_tab.style.position = 'absolute';
        previous_device_model_tab.style.left = 0;

        if(previous_device_model_tab_right_arrow_span) {
            previous_device_model_tab_right_arrow_span.style.display = 'none'
        }
        if(!previous_device_model_tab_left_arrow_span) {
            const previous_device_model_tab_left_arrow_span = document.createElement('span');
            previous_device_model_tab_left_arrow_span.className = 'left_arrow_span'
            previous_device_model_tab_left_arrow_span.innerHTML = left_arrow
            Object.assign(previous_device_model_tab_left_arrow_span.style , { display: 'block'})
            previous_device_model_tab.insertBefore(previous_device_model_tab_left_arrow_span, previous_device_model_tab.children[0])
            console.log(" previous_device_model_tab_left_arrow_span created", )
        } else {
            Object.assign(previous_device_model_tab_left_arrow_span.style , { display: 'block'})
        }
        console.log("previous_device", previous_device, previous_device_model_tab_left_arrow_span)
    }
    if(next_device) {
        const next_device_device_model_tab = document.querySelector(`.model_name_tab[data-serial_no="${next_device.getAttribute('data-serial_no')}"]`);
        let next_device_device_model_tab_right_arrow_span = document.querySelector(`.model_name_tab[data-serial_no="${next_device.getAttribute('data-serial_no')}"] .right_arrow_span`);
        let next_device_device_model_tab_left_arrow_span = document.querySelector(`.model_name_tab[data-serial_no="${next_device.getAttribute('data-serial_no')}"] .left_arrow_span`);

        next_device_device_model_tab.style.display = 'flex'
        next_device_device_model_tab.style.position = 'absolute';
        next_device_device_model_tab.style.right = 0;

        if(next_device_device_model_tab_left_arrow_span) {
            next_device_device_model_tab_left_arrow_span.style.display = 'none'
        }
        if(!next_device_device_model_tab_right_arrow_span) {
            const next_device_device_model_tab_right_arrow_span = document.createElement('span');
            next_device_device_model_tab_right_arrow_span.className = 'right_arrow_span'
            next_device_device_model_tab_right_arrow_span.innerHTML = right_arrow
            Object.assign(next_device_device_model_tab_right_arrow_span.style , { display: 'block'})
            next_device_device_model_tab.append(next_device_device_model_tab_right_arrow_span)
        } else {
            Object.assign(next_device_device_model_tab_right_arrow_span.style , { display: 'block'})
            console.log("has next_device_device_model_tab_right_arrow_span", next_device_device_model_tab_right_arrow_span)
        }
    }
}
let current_active_device_index = 0

function model_name_tab_clicked(serial_no) {
    console.log('model_name_tab_clicked')
    const tab_device = document.querySelector(`.mobile_device[data-serial_no='${serial_no}']`)
    mobile_device_thumbnail(tab_device)
}
function show_clicked_device(serial_no) {
    console.log('show_clicked_device')
    const dev = document.querySelector(`.mobile_device[data-serial_no='${serial_no}']`)
    dev.classList.toggle('selected')
    const device_model_tab = document.querySelector(`.model_name_tab[data-serial_no="${dev.getAttribute('data-serial_no')}"]`);
    dev.classList.contains('selected') ?
        device_model_tab.classList.add('selected'):
        device_model_tab.classList.remove('selected')
    // mobile_device_thumbnail(dev)

    document.querySelector('.selected_by_total_devices .selected_devices_count').innerHTML = document.querySelectorAll('.model_name_tab.selected').length || 0
}
function connected_device_mouseWheel(evt) {
    console.log('connected_device_mouseWheel')
    const devices = document.querySelectorAll('.mobile_device');
    // // obj.scrollLeft += (width * (Math.abs(evt.deltaY )/ evt.deltaY))
    let next_active_index = parseInt(current_active_device_index) + parseInt((Math.abs(evt.deltaY * -1) / evt.deltaY * -1) )
    if(next_active_index  < 0) next_active_index = 0
    if(next_active_index >= devices.length) next_active_index = devices.length - 1
    // console.log("index", current_active_device_index, next_active_index, devices.length)

    const next_active_device = document.querySelector(`.mobile_device[data-index='${next_active_index}']`)
    console.log("next_active_device", next_active_device)
    mobile_device_thumbnail(next_active_device)
    current_active_device_index = next_active_device.getAttribute('data-index')
    
}

var tooltipDelay = null;
function cleartooltips() {
    document.querySelectorAll('.tooltip').forEach(t => t.remove())
}
function show_tooltip(icon, rect, tooltip_text, position) {
    let tooltip = document.querySelector('.tooltip');
    if (tooltipDelay !== null) {
        clearTimeout(tooltipDelay); // clear the previous one
        tooltipDelay = null;
    }
    tooltipDelay = setTimeout(() => {
        const data_id = tooltip_text.replace(' ', '_')
        const appwindow = document.querySelector('.window');
        const { width: wWidth, height: wHeight } = get_window_size()
        const { x, y, width, height} = rect;
        let exist = false
        // current_showing_tooltip
        console.log("data_id", data_id)
        if(tooltip) {
            exist = true
        } else {
            tooltip = document.createElement('span');
        }
        
        tooltip.className = `tooltip`
        tooltip.setAttribute('data-id', data_id)
        tooltip.innerHTML = tooltip_text
        tooltip.style.visibility = 'hidden'
        tooltip.style.opacity = '0'

        if(document.querySelector(`[data-tooltip="${icon.getAttribute('data-tooltip')}"]`)) {
            console.log("Element Exist")
            if(!exist) {
                appwindow.append(tooltip)
            } 
        }
        console.log("tooltip", tooltip)

        const {width: tooltip_width} = tooltip.getBoundingClientRect()

        let tooltip_left = Math.ceil(tooltip_width) + x > wWidth ? ((width + x) - tooltip_width) : x

        if(position === "left") {
            tooltip.style.top = `${y}px`;
            tooltip.style.left = `${x - tooltip_width }px`;
        } else if(position === "right") {
            tooltip.style.top = `${y}px`;
            tooltip.style.left = `${x + (width * 1.2)}px`;
        } else {
            tooltip.style.top = `${y + height}px`;
            tooltip.style.left = `${tooltip_left}px`;
        
        }
        tooltip.style.visibility = 'visible'
        tooltip.style.opacity = '1'
    }, tooltip ? 0: 1000)
            
}

function get_window_size() {
    console.log('get_window_size')
    return {'width': window.outerWidth, 'height': window.outerHeight}
}

function window_actions_mouse_moved(event) {
    console.log('window_actions_mouse_moved')
        const { target: icon } = event;
        show_tooltip(icon, icon.getBoundingClientRect(), icon.getAttribute('data-tooltip'))
}
function window_actions_mouse_leave(event) {
    console.log('window_actions_mouse_leave')
    cleartooltips()
    if(tooltipDelay){
        clearTimeout(tooltipDelay);
        tooltipDelay = null;
    }
}
function folder_action_icon_mouse_move(event) {
    console.log('folder_action_icon_mouse_move')
    const { target: icon } = event;
    show_tooltip(icon, icon.getBoundingClientRect(), icon.getAttribute('data-tooltip'), icon.getAttribute('data-tooltip_position'))
}

function folder_action_icon_mouse_leave() {
    console.log('folder_action_icon_mouse_leave')
    cleartooltips()
    if(tooltipDelay){
        clearTimeout(tooltipDelay);
        tooltipDelay = null;
    }
}

window.addEventListener('beforeunload', () => {
    console.log("Before load")
})

function mail_type_item_click(item) {
    const mail_type_value = document.querySelector('.mail_type_value');
    mail_type_value.innerHTML = item.innerHTML
    mail_type_value.setAttribute('data-value', item.getAttribute('data-value'))
}

function change_mail_type() {
    const mail_type_value = document.querySelector('.mail_type_value');
    const mail_types_dropdown = document.querySelector('.mail_types_dropdown')
    const mail_types_dropdown_items = mail_types_dropdown.children;

    mail_types_dropdown.classList.toggle('show')

    if(mail_types_dropdown.classList.contains('show')) {
        // Remove current value from list 
        const current_mail_type_item = [...mail_types_dropdown_items].filter(i => i.getAttribute('data-value') === mail_type_value.getAttribute('data-value'))[0]
        const other_items =  [...mail_types_dropdown_items].filter(i => i !== current_mail_type_item)
        console.log("==> ", current_mail_type_item, other_items)
        // Remove all children
        mail_types_dropdown.innerHTML = ''

        mail_types_dropdown.append(current_mail_type_item)
        
        for(let item of other_items) {
            mail_types_dropdown.append(item)
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const pinedFolders = JSON.parse( window.localStorage.getItem('pinedFolders')) || []
    if(pinedFolders.length > 0) {
        for(let f of pinedFolders) {
            const original_folder_path = window.localStorage.getItem(f)
            const last_sessions_active_folders = JSON.parse(window.localStorage.getItem('selected_folders')) || []
            add_folder_to_html(path.basename(original_folder_path), original_folder_path, last_sessions_active_folders.includes(f), 'pinned')
            
            if(last_sessions_active_folders.includes(f)) { 
                add_apks_from_folder(original_folder_path) 
            }
            else { 
                 add_apks_from_folder(original_folder_path, keepInStorage = true)
            }

        }
    }

    document.querySelector('.window').classList.add('loaded')
})