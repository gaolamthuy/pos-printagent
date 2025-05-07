require("dotenv").config();
const puppeteer = require("puppeteer-core");
const printer = require("pdf-to-printer");
const chalk = require("chalk");
const path = require("path");
const os = require("os");
const fs = require("fs");
const axios = require("axios");
const readline = require("readline");
const config = require("./config.json");
const log = require("./log");

const SETTINGS = {
  backendUrl: process.env.BACKEND_URL,
  authUser: process.env.AUTH_USERNAME,
  authPass: process.env.AUTH_PASSWORD,
  printAgentId: process.env.PRINT_AGENT_ID,
};

let browser;
let isPrinting = false;
const jobQueue = [];

async function initBrowser() {
  if (browser) await browser.close();
  browser = await puppeteer.launch({
    executablePath: config.chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  log.success(`[INIT] Puppeteer ready`);
}

function getPrinterConfigFromDocType(docType) {
  const printerKey = config.routes[docType] || config.routes["default"];
  const printerConfig = config.printers[printerKey];
  if (!printerConfig) throw new Error(`Missing printer config for: ${docType}`);
  return { printerKey, name: printerConfig.name, format: printerConfig.format };
}

function buildRenderUrl(docType, docRef) {
  if (docType === "invoice") {
    return `${SETTINGS.backendUrl}/print/kv-invoice?code=${docRef.code}`;
  } else if (docType === "label") {
    return `${SETTINGS.backendUrl}/print/label-product?code=${docRef.code}&quantity=${docRef.quantity}`;
  }
  throw new Error("Unsupported doc_type");
}

async function renderAndPrint(url, printerName, format) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle0", timeout: 10000 });

  const tmpPath = path.join(os.tmpdir(), `print-${Date.now()}.pdf`);
  const pdfOptions = { path: tmpPath, printBackground: true };

  if (typeof format === "string") {
    pdfOptions.format = format;
  } else if (typeof format === "object") {
    pdfOptions.width = format.width;
    pdfOptions.height = format.height;
  }

  await page.pdf(pdfOptions);
  await page.close();

  await printer.print(tmpPath, {
    printer: printerName,
    options: ["-print-settings", "fit"],
  });

  fs.unlinkSync(tmpPath);
  log.success(`[PRINTED] Sent to ${printerName}`);
}

async function fetchRemoteJobs() {
  const agentId = SETTINGS.printAgentId;
  const url = `${
    SETTINGS.backendUrl
  }/print/jobs?print_agent_id=${encodeURIComponent(agentId)}`;
  const auth = Buffer.from(
    `${SETTINGS.authUser}:${SETTINGS.authPass}`
  ).toString("base64");

  log.info(`[FETCH] ${url}`);

  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    log.success(`[RESPONSE] Status: ${response.status}`);
    const jobs = response.data.data;

    if (Array.isArray(jobs)) {
      log.info(`[FETCHED] ${jobs.length} job(s)`);
      for (const job of jobs) {
        const { doc_type, doc_ref } = job;
        log.info(`[JOB] ${doc_type} → ${JSON.stringify(doc_ref)}`);
        if (["invoice", "label"].includes(doc_type) && doc_ref?.code) {
          jobQueue.push({ id: job.id, doc_type, doc_ref });
        } else {
          log.warn(`[SKIP] Invalid job structure`);
        }
      }
    } else {
      log.error(`[ERROR] Invalid job format from backend`);
    }
  } catch (err) {
    log.error(`[FETCH ERROR] ${err.message}`);
    if (err.response) log.error(`→ ${JSON.stringify(err.response.data)}`);
  }
}

async function markJobAsDone(jobId) {
  const url = `${SETTINGS.backendUrl}/print/jobs/${jobId}`;
  const auth = Buffer.from(
    `${SETTINGS.authUser}:${SETTINGS.authPass}`
  ).toString("base64");

  try {
    await axios.put(
      url,
      { status: "done" },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );
    log.success(`[UPDATED] Job ${jobId} marked as done`);
  } catch (err) {
    log.error(`[UPDATE FAIL] Job ${jobId} → ${err.message}`);
    if (err.response) log.error(`→ ${JSON.stringify(err.response.data)}`);
  }
}

async function processQueue() {
  if (isPrinting || jobQueue.length === 0) return;
  isPrinting = true;

  const { id, doc_type, doc_ref } = jobQueue.shift();
  try {
    const { name: printerName, format } = getPrinterConfigFromDocType(doc_type);
    const url = buildRenderUrl(doc_type, doc_ref);
    const copies = doc_type === "label" ? doc_ref.copies || 1 : 1;

    for (let i = 0; i < copies; i++) {
      await renderAndPrint(url, printerName, format);
    }

    log.info(`[DONE] ${doc_type} printed (${copies} copy)`);
    await markJobAsDone(id);
  } catch (err) {
    log.error(`[ERROR] ${err.message}`);
  } finally {
    isPrinting = false;
  }
}

async function runTest(printerKey) {
  await initBrowser();
  const printerConfig = config.printers[printerKey];
  if (!printerConfig) {
    log.error(`[TEST FAIL] Printer config not found: ${printerKey}`);
    process.exit(1);
  }

  const url = `${SETTINGS.backendUrl}/print/label-product?code=2021101&quantity=1`;
  log.info(`[TEST] In nhãn label thực tế cho máy in: ${printerKey}`);

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });

    const tmpPdf = path.join(os.tmpdir(), `test-label-${Date.now()}.pdf`);
    const pdfOptions = {
      path: tmpPdf,
      printBackground: true,
    };

    if (typeof printerConfig.format === "string") {
      pdfOptions.format = printerConfig.format;
    } else {
      pdfOptions.width = printerConfig.format.width;
      pdfOptions.height = printerConfig.format.height;
    }

    await page.pdf(pdfOptions);
    await page.close();

    await printer.print(tmpPdf, {
      printer: printerConfig.name,
      options: ["-print-settings", "fit"],
    });

    fs.unlinkSync(tmpPdf);
    log.success(`[TEST DONE] Đã in nhãn thực tế tới máy in: ${printerKey}`);
    process.exit(0);
  } catch (err) {
    log.error(`[TEST FAIL] Máy in ${printerKey} → ${err.message}`);
    process.exit(1);
  }
}

function askStartupMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.magenta("Chọn chế độ khởi động:"));
  console.log(" 1. 🖨️ Start print agent (auto polling)");
  console.log(" test1 → test printer 1");
  console.log(" test2 → test printer 2");
  console.log(" test3 → test printer 3");
  console.log(chalk.gray(" ⏳ Auto start sau 10s...\n"));

  const timeout = setTimeout(() => {
    rl.close();
    log.info("Auto start...");
    main();
  }, 10000);

  rl.question("→ Nhập lựa chọn: ", async (answer) => {
    clearTimeout(timeout);
    rl.close();
    if (answer === "1") return main();
    if (answer === "test1")
      return await runTest(Object.keys(config.printers)[0]);
    if (answer === "test2")
      return await runTest(Object.keys(config.printers)[1]);
    if (answer === "test3")
      return await runTest(Object.keys(config.printers)[2]);
    log.warn("Lựa chọn không hợp lệ. Thoát.");
    process.exit(1);
  });
}

async function main() {
  log.info(`🖨️  GLT Print Agent (Polling Mode)`);
  await initBrowser();
  setInterval(fetchRemoteJobs, 5000);
  setInterval(processQueue, 1000);
}

askStartupMode();
