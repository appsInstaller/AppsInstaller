var monitor = require('node-usb-detection');

const not_connected_device = `
  <div class = "not_connected_device">
    <svg class = "main_svg android_svg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" id="Layer_1" x="0px" y="0px" viewBox="0 0 1200 1200" enable-background="new 0 0 1200 1200" xml:space="preserve">
        <g>
            <path d="M304.851,881.692c0,49.888,47.177,47.177,47.177,47.177h64.355c0,0,0,92.45,0,154.941   c0,62.599,63.443,63.479,63.443,63.479c68.934,0.88,68.018-58.901,68.018-58.901V931.58H656.56v152.23c0,0,2.747,66.19,66.19,66.19   c63.512,0,66.115-66.19,66.115-66.19V927.037c0,0,31.758,0,66.19,0c34.501,0,43.514-43.514,43.514-43.514v-488.56H304.851   C304.851,394.963,304.851,831.873,304.851,881.692z"/>
            <path d="M1067.138,740.302c0,0,0-271.019,0-280.522c0-9.543-0.422-64.817-64.781-64.817   c-64.355,0-64.355,64.359-64.355,64.359s0,259.223,0,278.233c0,19.049,1.828,63.266,68.652,63.266   C1073.616,800.822,1067.138,740.302,1067.138,740.302z"/>
            <path d="M261.828,459.78c0-9.543-0.422-64.817-64.781-64.817c-64.355,0-64.355,64.359-64.355,64.359   s0,259.223,0,278.233c0,19.049,1.759,63.266,68.58,63.266c66.893,0,60.555-60.519,60.555-60.519S261.828,469.283,261.828,459.78z"/>
            <path d="M745.492,143.239l51.261-75.975c8.732-12.29-2.185-15.21-2.185-15.21   c-7.25-5.808-13.025,4.366-13.025,4.366l-53.23,79.212c-37.32-15.279-78.934-23.902-122.942-24.36   c-45.417-0.353-88.65,8.061-127.517,23.621c-16.054-23.058-57.459-82.485-60.415-84.281c-3.591-2.185-8.66,2.181-8.66,2.181   c-9.366,7.254-5.072,10.844-5.072,10.844l54.149,79.987c-82.947,40.208-142.093,114.773-153.64,206.03h594.14   C887.303,258.08,828.651,183.375,745.492,143.239z M475.248,269.945c-18.235,0-33.091-14.857-33.091-33.128   c0-18.238,14.857-33.059,33.091-33.059c18.307,0,33.164,14.821,33.164,33.059C508.411,255.088,493.555,269.945,475.248,269.945z    M729.579,269.945c-18.238,0-33.023-14.857-33.023-33.128c0-18.238,14.785-33.059,33.023-33.059   c18.379,0,33.164,14.821,33.164,33.059C762.742,255.088,747.958,269.945,729.579,269.945z"/>
        </g>
    </svg>
    <p>
        Connect your device 
        <span style = "--s: 1">.</span>
        <span style = "--s: 2">.</span>
        <span style = "--s: 3">.</span>
    </p>
  </div>
`

function create_device(serial_no, index, model) {
    return new Promise(resolve => {
        let result = ''
        const process = spawn('./adb_files/adb', ['-s', serial_no, 'shell', 'getprop', '|', 'grep', '-e', "ro.product.vendor", '-e', 'version.release'], { encoding : 'utf8' })
        process.on('close', (code) => {
            console.log("data", result)
            const brand = result.split('\n').filter(f => f.split(':').at(0).search(/manufacturer/gi) > 0)[0].split(":").at(-1).replace(/\[|\]|\r/g, "").trim()
            console.log("brand", brand)
            // const model = result.split('\n').filter(f => f.split(':').at(0).search(/marketname|model/gi) > 0)[0].split(":").at(-1).replace(/\[|\]|\r/g, "").trim().replace(brand, '')
            // console.log("model", model)
            const android_version = result.split('\n').filter(f => f.split(':').at(0).search(/version.release/gi) > 0)[0].split(":").at(-1).replace(/\[|\]|\r/g, "").trim()
            console.log("android_version", android_version)
        
            const mobile_device = document.createElement('div');
            mobile_device.className = `mobile_device ${serial_no} current_showing selected`
            mobile_device.setAttribute('data-serial_no', serial_no)
            mobile_device.setAttribute('data-name', `${brand} ${model}`)
            mobile_device.setAttribute('data-index', index)
            mobile_device.onclick = () => show_clicked_device(serial_no)

            const mobile_device_notch = document.createElement('div');
            mobile_device_notch.className = 'mobile_device__notch'

            const mobile_device_screen = document.createElement('div');
            mobile_device_screen.className = "mobile_device__screen"

            const status_bar = document.createElement('div');
            status_bar.className = "status_bar"

            const app_screen = document.createElement('div');
            app_screen.className = "app_screen"
            app_screen.innerHTML = `
                <div class = "connected_device">
                    <p class = "brand">${brand}</p>
                    <div class = "model_vs_av">
                        <span class = "model">${model}</span>
                        <span class = "android_version">( Android ${android_version} )</span>
                    </div>
                    <div class = "installation_logs installation_logs__${serial_no}">
                    </div>
                </div>
            `

            mobile_device.append(mobile_device_notch)

            mobile_device_screen.append(status_bar)
            mobile_device_screen.append(app_screen)
            mobile_device.append(mobile_device_screen)
            
            resolve(mobile_device)
        })
        process.stdout.on('data', (data) => {
            result += data.toString()
        });

    })
 }

async function checkDevice() {
    const container = document.querySelector('.mainWindow__right')
    document.querySelector(".apps_install_btn").classList.add("disabled")
    container.innerHTML = not_connected_device

    setTimeout(() => 
       {
            const check_devices = spawn('./adb_files/adb', [ 'devices', '-l'])
            check_devices.stdout.on('data', async (data) => {
                const device_container =  document.createElement('div')
                device_container.className = 'connected_devices'
                device_container.onwheel = () => connected_device_mouseWheel(event)

                const devices = data.toString()
                .replace("List of devices attached", "")
                .split(/[\n\r]/)
                .filter(f => f)
                // console.log("data", data, devices)
                // // let serial_nos = []
                console.log("devices", devices)
                if(devices.length > 0) {
                    container.innerHTML = ""
                    document.querySelector(".apps_install_btn").classList.remove("disabled")

                    
                    let model_name_tabs = document.createElement('div')
                    model_name_tabs.className = 'model_names_tabs'

                    let selected_by_total_devices = document.createElement('div')
                    selected_by_total_devices.className = 'selected_by_total_devices'
                    selected_by_total_devices.innerHTML = `
                        <p>
                            <span class = 'selected_devices_count'>${devices.length}</span>
                            /
                            <span class = "total_devices_count">${devices.length}</span>
                            Device${devices.length > 1 ? "s": ''} Selected.
                        </p>
                    `
                    
                    let current_showing_device = document.createElement('div')
                    current_showing_device.className = 'current_showing_device'

                    for(d of devices) {
                        let [serial_no, _, product, model, device, transport_id] = d.split(" ").filter(f => f)
                        // serial_nos.push(serial_no)
                        console.log('serial_no --------------------->', serial_no, product, model, device, transport_id)
                        const mobile_device = await create_device(serial_no, devices.indexOf(d), model.replace('model:', '').replace('_', ' '))
                        current_showing_device.append(mobile_device)
                        console.log("mobile_device", mobile_device)
                        const model_name_tab = document.createElement('span');
                        model_name_tab.onclick = () => model_name_tab_clicked(serial_no)
                        model_name_tab.setAttribute('data-serial_no', serial_no)
                        model_name_tab.setAttribute('class', 'model_name_tab current_showing_model selected')
                        model_name_tab.innerHTML = `<span>${model.replace('model:', '').replace('_', ' ')}</span>`
                        
                        model_name_tabs.append(model_name_tab)
                    }device_container.append(model_name_tabs)
                    device_container.append(current_showing_device)
                    device_container.append(selected_by_total_devices)
                    container.append(device_container)
                    mobile_device_thumbnail(current_showing_device.children[0])
                    console.log("____________________________________")
                } 
            });
       }
    , 1000)

}

monitor.change(() => checkDevice());

window.addEventListener('DOMContentLoaded', () => {
    checkDevice()
})