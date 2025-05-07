// log.js
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// Auto cleanup logs > N ngày
const RETAIN_DAYS = 7;
fs.readdirSync(logDir).forEach((file) => {
  const filePath = path.join(logDir, file);
  const stat = fs.statSync(filePath);
  const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
  if (ageDays > RETAIN_DAYS) fs.unlinkSync(filePath);
});

function getLogFilePath() {
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  return path.join(logDir, `${today}.log`);
}

function formatTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function writeToFile(level, message) {
  const line = `[${formatTime()}] ${level.toUpperCase()} - ${message}\n`;
  fs.appendFileSync(getLogFilePath(), line);
}

function log(level, color, message) {
  const colored = chalk[color](`[${level.toUpperCase()}] ${message}`);
  console.log(colored);
  writeToFile(level, message);
}

module.exports = {
  info: (msg) => log("info", "cyan", msg),
  success: (msg) => log("success", "green", msg),
  warn: (msg) => log("warn", "yellow", msg),
  error: (msg) => log("error", "red", msg),
  raw: writeToFile,
};
