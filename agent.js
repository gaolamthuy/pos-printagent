// agent.js

require("dotenv").config();
const axios = require("axios");
const puppeteer = require("puppeteer-core");
const readline = require("readline");
const path = require("path");
const fs = require("fs");
const os = require("os");
const printer = require("pdf-to-printer");
const chalk = require("chalk");

const config = require("./config.json");

const SETTINGS = {
  serverUrl: process.env.SERVER_URL || "http://localhost:3001",
  authorization:
    process.env.AUTHORIZATION || "Basic dXNlcm5hbWUxMjM6cGFzc3dvcmQxMjM0NTY=",
  defaultPrinterKey: "printer1",
  printerFormats: {
    "Canon LBP2900": "A5",
    "Epson L3150": "A4",
    "Zebra TLP2824": "Custom",
  },
};

function getPrinterKey(printerName) {
  return Object.entries(config.printers).find(
    ([_, name]) => name === printerName
  )?.[0];
}

let logCounter = 0;
function logInfo(message) {
  if (++logCounter % 500 === 0) console.clear();
  console.log(
    chalk.cyan(`[INFO] [${new Date().toLocaleTimeString()}] ${message}`)
  );
}

function logSuccess(message) {
  console.log(
    chalk.green(`[SUCCESS] [${new Date().toLocaleTimeString()}] ${message}`)
  );
}

function logWarning(message) {
  console.log(
    chalk.yellow(`[WARNING] [${new Date().toLocaleTimeString()}] ${message}`)
  );
}

function logError(message) {
  console.log(
    chalk.red(`[ERROR] [${new Date().toLocaleTimeString()}] ${message}`)
  );
}

let browser;

async function initBrowser() {
  browser = await puppeteer.launch({
    executablePath: config.chromiumPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

async function silentPrint(target, printerName) {
  const printerKey = getPrinterKey(printerName);
  const formatSetting = config.formats?.[printerKey] || "A5";

  const pdfOptions = {
    path: pdfPath,
    printBackground: true,
  };

  if (typeof formatSetting === "string") {
    pdfOptions.format = formatSetting;
  } else if (typeof formatSetting === "object") {
    pdfOptions.width = formatSetting.width;
    pdfOptions.height = formatSetting.height;
  }

  logInfo(
    `Format for ${printerName} (${printerKey}): ${JSON.stringify(
      formatSetting
    )}`
  );
  await page.pdf(pdfOptions);

  await page.close();

  logInfo(`Sending PDF to printer ${printerName}...`);
  await printer.print(pdfPath, {
    printer: printerName,
    options: ["-print-settings", "fit"],
  });

  try {
    fs.unlinkSync(pdfPath);
    logSuccess(`Temp PDF deleted.`);
  } catch (err) {
    logWarning(`Failed to delete temp file: ${err.message}`);
  }
}

async function pollServer() {
  try {
    const response = await axios.get(`${SETTINGS.serverUrl}/print/jobs`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: SETTINGS.authorization,
      },
    });

    const jobs = response.data?.data || [];
    if (jobs.length === 0) {
      logInfo(`No job.`);
      return;
    }

    for (const job of jobs) {
      await axios.put(
        `${SETTINGS.serverUrl}/print/jobs/${job.id}`,
        {},
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: SETTINGS.authorization,
          },
        }
      );

      const code = job.kv_invoices?.code;
      const docUrl = `${SETTINGS.serverUrl}/print/kv-invoice?code=${code}`;
      const printerName = config.printers[SETTINGS.defaultPrinterKey];

      logInfo(`Printing invoice ${code} on ${printerName}...`);
      await silentPrint(docUrl, printerName);

      logSuccess(`Print job ${job.id} completed.`);
    }
  } catch (error) {
    logError(`Polling failed: ${error.message}`);
  }
}

let pollingStarted = false;

function startPolling() {
  logInfo(
    `Polling started... every ${config.pollingIntervalMs / 1000} seconds.`
  );
  setInterval(pollServer, config.pollingIntervalMs);
}

function listenTerminal() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("line", async (input) => {
    input = input.trim().toLowerCase();

    if (input.startsWith("test")) {
      const num = input.replace("test", "");
      const printerKey = `printer${num}`;
      const printerName = config.printers[printerKey];

      if (printerName) {
        logInfo(`Sending Test Page to ${printerName}...`);
        await silentPrint(
          path.resolve(__dirname, "printers/test-page.html"),
          printerName
        );
        logSuccess(`Test Page sent.`);
      } else {
        logWarning(`Invalid printer number.`);
      }
    }

    if (input === "go" || input === "go prod") {
      if (!pollingStarted) {
        logInfo(`Starting production polling...`);
        startPolling();
        pollingStarted = true;
      } else {
        logWarning(`Polling already started.`);
      }
    }

    if (input === "help") {
      console.log("\nCommands:");
      console.log(
        " - test1 / test2 / test3 : Print test page on selected printer"
      );
      console.log(" - go or go prod        : Start production polling");
      console.log(" - exit                 : Exit program");
      console.log(" - help                 : Show commands\n");
    }

    if (input === "exit") {
      logInfo(`Exiting...`);
      process.exit(0);
    }
  });
}

async function main() {
  console.log(chalk.cyan("==========================================="));
  console.log(chalk.magenta("POS Print Agent v1.0"));
  console.log(chalk.green(`Server URL     : ${SETTINGS.serverUrl}`));
  console.log(
    chalk.green(
      `Default Printer: ${config.printers[SETTINGS.defaultPrinterKey]}`
    )
  );
  console.log(chalk.green("Available Printers:"));
  Object.entries(config.printers).forEach(([key, value]) => {
    console.log(chalk.yellow(` - ${key}: ${value}`));
  });
  console.log(chalk.green("Page Format Settings:"));
  Object.entries(SETTINGS.printerFormats).forEach(([printer, format]) => {
    console.log(chalk.yellow(` - ${printer}: ${format}`));
  });
  console.log(chalk.cyan("===========================================\n"));

  console.log(chalk.cyan("Type 'help' to see available commands.\n"));

  await initBrowser();
  listenTerminal();
}

main();
