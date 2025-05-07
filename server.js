require("dotenv").config();
const express = require("express");
const puppeteer = require("puppeteer-core");
const printer = require("pdf-to-printer");
const chalk = require("chalk");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");
const config = require("./config.json");
const log = require("./log");

log.info("Server started");
log.success("Print completed");
log.error("Failed to open browser");
log.warn("Retrying job...");

const app = express();
const PORT = process.env.PORT || 3002;
const SETTINGS = {
  backendUrl: process.env.BACKEND_URL,
};

app.use(express.json());

let browser;
let isPrinting = false;
const jobQueue = [];

function banner() {
  console.log(chalk.cyan("\n╔══════════════════════════════════════════╗"));
  console.log(chalk.magenta("  🖨️  GLT POS Print Agent v1.0"));
  console.log(chalk.green(`  🌐 Backend: ${SETTINGS.backendUrl}`));
  console.log(chalk.green(`  🚀 Port   : ${PORT}`));
  console.log(chalk.yellow("  📄 Available Printers:"));
  Object.entries(config.printers).forEach(([key, val]) => {
    console.log(`   • ${chalk.cyan(key)} → ${val.name}`);
  });
  console.log(chalk.cyan("╚══════════════════════════════════════════╝\n"));
}

async function initBrowser() {
  if (browser) await browser.close();
  browser = await puppeteer.launch({
    executablePath: config.chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  console.log(chalk.green(`[INIT] Puppeteer ready`));
}

function getPrinterConfigFromDocType(docType) {
  const printerKey = config.routes[docType] || config.r["default"];
  const printerConfig = config.printers[printerKey];
  if (!printerConfig)
    throw new Error(`Printer config not found: ${printerKey}`);
  return { printerKey, name: printerConfig.name, format: printerConfig.format };
}

function buildRenderUrl(docType, docRef) {
  if (docType === "invoice") {
    if (!docRef.code) throw new Error("Missing invoice code");
    return `${SETTINGS.backendUrl}/print/kv-invoice?code=${docRef.code}`;
  } else if (docType === "label") {
    if (!docRef.code || !docRef.quantity)
      throw new Error("Missing label code/quantity");
    return `${SETTINGS.backendUrl}/print/label-product?code=${docRef.code}&quantity=${docRef.quantity}`;
  } else {
    throw new Error("Unsupported doc_type");
  }
}

async function renderAndPrint(htmlUrl, printerName, format) {
  let page;
  try {
    page = await browser.newPage();
    await page.goto(htmlUrl, { waitUntil: "networkidle0", timeout: 10000 });
  } catch (err) {
    console.log(chalk.yellow(`[FAILOVER] Browser failed → restarting`));
    await initBrowser();
    page = await browser.newPage();
    await page.goto(htmlUrl, { waitUntil: "networkidle0", timeout: 10000 });
  }

  const tmpPdfPath = path.join(os.tmpdir(), `print-${Date.now()}.pdf`);
  const pdfOptions = { path: tmpPdfPath, printBackground: true };

  if (typeof format === "string") {
    pdfOptions.format = format;
  } else if (typeof format === "object") {
    pdfOptions.width = format.width;
    pdfOptions.height = format.height;
  }

  await page.pdf(pdfOptions);
  await page.close();

  console.log(chalk.blue(`[PRINT] Sending to ${printerName}`));
  await printer.print(tmpPdfPath, {
    printer: printerName,
    options: ["-print-settings", "fit"],
  });

  fs.unlinkSync(tmpPdfPath);
  console.log(chalk.green(`[DONE] Printed → ${printerName}`));
}

async function processQueue() {
  if (isPrinting || jobQueue.length === 0) return;
  isPrinting = true;

  const { doc_type, doc_ref } = jobQueue.shift();
  log.info(`[QUEUE] Job: ${doc_type} - ${JSON.stringify(doc_ref)}`);

  try {
    const { name: printerName, format } = getPrinterConfigFromDocType(doc_type);
    const htmlUrl = buildRenderUrl(doc_type, doc_ref);
    const copies = doc_type === "label" ? doc_ref.copies || 1 : 1;

    for (let i = 0; i < copies; i++) {
      await renderAndPrint(htmlUrl, printerName, format);
      if (copies > 1) log.info(`Printed copy ${i + 1}/${copies}`);
    }

    log.success(`[DONE] ${doc_type} printed with ${copies} copy(ies)`);
  } catch (err) {
    log.error(`[FAIL] ${doc_type} - ${err.message}`);
  } finally {
    isPrinting = false;
    setTimeout(processQueue, 100);
  }
}

app.post("/print", async (req, res) => {
  const { doc_type, doc_ref } = req.body;
  console.log(chalk.gray(`[RECEIVED]`, { doc_type, doc_ref }));

  if (!["invoice", "label"].includes(doc_type)) {
    return res.status(400).json({ error: "Unsupported doc_type" });
  }

  if (!doc_ref || typeof doc_ref !== "object" || !doc_ref.code) {
    return res.status(400).json({ error: "Invalid doc_ref" });
  }

  jobQueue.push({ doc_type, doc_ref });
  processQueue();
  res.json({ success: true, queued: true });
});

function startServer() {
  app.listen(PORT, async () => {
    await initBrowser();
    banner();
    console.log(
      chalk.yellow(`🚀 Server listening at http://localhost:${PORT}\n`)
    );
  });
}

async function runTest(type = "invoice") {
  await initBrowser();
  banner();
  const doc_ref =
    type === "invoice"
      ? { code: "HD057559" }
      : { code: "2021101", quantity: 2 };
  const { name: printerName, format } = getPrinterConfigFromDocType(type);
  const htmlUrl = buildRenderUrl(type, doc_ref);

  console.log(
    chalk.yellow(`[TEST MODE] ${type.toUpperCase()} on ${printerName}`)
  );
  console.log(chalk.gray(`→ ${htmlUrl}`));

  try {
    await renderAndPrint(htmlUrl, printerName, format);
    console.log(chalk.green(`[TEST DONE] Printed ${type}`));
  } catch (err) {
    console.log(calk.red(`[TEST ERROR] ${err.message}`));
  } finally {
    process.exit(0);
  }
}

function askStartupMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.magenta("Choose startup mode:"));
  console.log(` 1. ${chalk.yellow("Start Print Agent Server")}`);
  console.log(` 2. ${chalk.cyan("Test Print Invoice")}`);
  console.log(` 3. ${chalk.cyan("Test Print Label")}`);
  rl.question("\nEnter your choice (1/2/3): ", async (answer) => {
    rl.close();
    if (answer === "1") return startServer();
    if (answer === "2") return await runTest("invoice");
    if (answer === "3") return await runTest("label");
    console.log("Invalid option. Exit.");
    process.exit(1);
  });
}

askStartupMode();
