# 🖨️ GLT POS Print Agent

A lightweight Node.js print agent that polls your internal server and silently prints HTML documents to assigned printers.

---

## ✅ Features

- Polls print jobs from internal API every X seconds (default: 2s)
- Supports up to 3 printers (receipts, A4, thermal)
- Assigns printer based on `doc_type` (e.g., `invoice`, `label`, etc.)
- Per-printer paper format (A4, A5, custom mm)
- Converts HTML to PDF via Puppeteer
- Prints PDF silently using `pdf-to-printer`
- Cleans up temporary files
- Logs activity with color-coded terminal output
- Auto console clear every 500 logs
- Help command for on-screen guidance
- Ready to be auto-launched via Windows Startup folder

---

## 🛠️ Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure `config.json`

```json
{
  "pollingIntervalMs": 2000,
  "chromiumPath": "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "printers": {
    "invoice-k80": "HP LaserJet P15",
    "invoice-a5": "XP-80C",
    "label": "XP-350B"
  },
  "formats": {
    "invoice-k80": { "width": "79mm", "height": "100mm" },
    "invoice-a5": "A5",
    "label": { "width": "75mm", "height": "100mm" }
  }
}
```

- The `doc_type` value from the job (e.g., `invoice`, `label`) is mapped to the correct printer name.
- The printer name then maps to a paper size in the `formats` block.

---

## ▶️ Running the Agent

```bash
node agent.js
```

### 🧪 Manual Test Print

Type one of the following in the terminal:

```
test1      → Send test page to printer 1 (Canon A5)
test2      → Send test page to printer 2 (Canon A4)
test3      → Send test page to printer 3 (Xprinter 80mm)
```

### 🚀 Start Polling (Production Mode)

```
go
```

### ❓ Help

```
help
```

### 🔚 Exit

```
exit
```

---

## 🖥️ Windows Auto Startup (Optional)

1. Create a file `start-agent.bat`:

   ```bat
   @echo off
   cd /d C:\Path\To\glt-nodejs-printagent
   node agent.js
   exit
   ```

2. Press `Win + R` → type `shell:startup`

3. Place a shortcut to `start-agent.bat` in that folder

---

## 💡 Notes

- HTML is expected to be fully styled for correct layout
- Printer is selected based on `doc_type` field
- Format is selected based on the resolved printer name
- All print jobs are acknowledged by `PUT /print/jobs/:id` after print
- Temp files are auto-cleaned after every print
- Chrome path can be adjusted in `config.json`

---

## ✅ You’re Ready

Start the agent, leave it running, and your POS will auto-handle printing like a champ 🔥
