
# POS Print Agent

A lightweight print job listener for POS systems. It polls a backend server for new print jobs and sends them to configured printers.

---

## 🚀 Setup

### 1. Clone the project

```bash
git clone https://github.com/gaolamthuy/pos-printagent.git
cd pos-printagent
```

### 2. Install dependencies

```
npm install
```

### 3. Configure printers

Edit the `config.json` file to define your printer names and formats:

```
{
  "pollingIntervalMs": 2000,
  "chromiumPath": "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "printers": {
    "invoice-k80": "HP LaserJet P15",
    "invoice-a4": "XP-80C",
    "label": "XP-350B"
  },
  "formats": {
    "invoice-k80": "A5",
    "invoice-a4": "A4",
    "label": { "width": "75mm", "height": "100mm" }
  }
}
```

----------

## 🔁 Run manually

```
npm start
```

----------

## ⚙️ Install as Windows Service (Auto Start)

### 1. Install `node-windows` globally

```
npm install -g node-windows
```

### 2. Create `install-service.js`

This script automatically installs and starts the print agent as a Windows Service:

```
const path = require('path');
const os = require('os');
const Service = require('node-windows').Service;

const userHome = os.homedir();

const svc = new Service({
  name: 'POS PrintAgent',
  description: 'Auto-start POS Print Agent',
  script: path.join(userHome, 'pos-printagent', 'index.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

svc.on('install', () => {
  console.log("Service installed. Starting...");
  svc.start();
});

svc.install();
```

> ⚠️ Make sure your app is cloned to `C:\Users\<yourname>\pos-printagent` or adjust the path accordingly.

### 3. Run the script to install the service

```
node install-service.js
```

----------

## 🧯 Uninstall Service (Optional)

```
svc.uninstall();
```

Or run a similar `uninstall-service.js` file with:

```
svc.on('uninstall', () => {
  console.log('Service uninstalled.');
});
svc.uninstall();
```

----------

## 🖨️ Supported Printers

Make sure the printer names in `config.json` match your **Windows printer names**. You can check them in `Control Panel > Printers`.

----------

## 📄 License

MIT
