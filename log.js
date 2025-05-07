// log.js
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

// Optional: clean up logs older than N days
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

function logToFile(level, message) {
  const time = new Date().toTimeString().split(" ")[0];
  const line = `[${time}] ${level.toUpperCase()} - ${message}\n`;
  fs.appendFileSync(getLogFilePath(), line);
}

function log(level, color, message) {
  console.log(chalk[color](`[${level.toUpperCase()}] ${message}`));
  logToFile(level, message);
}

module.exports = {
  info: (msg) => log("info", "cyan", msg),
  success: (msg) => log("success", "green", msg),
  warn: (msg) => log("warn", "yellow", msg),
  error: (msg) => log("error", "red", msg),
  raw: logToFile,
};
