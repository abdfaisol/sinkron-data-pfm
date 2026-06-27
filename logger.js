const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, 'log');

// Buat direktori log jika belum ada
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Format nama file berdasarkan tanggal: YYYY-MM-DD.txt
const getLogFileName = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return path.join(logDir, `${year}-${month}-${day}.txt`);
};

const writeLog = (level, ...args) => {
  const timestamp = new Date().toISOString();
  // Format pesan menggunakan util.format agar mirip dengan console.log bawaan
  const util = require('util');
  const message = util.format(...args);
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  
  // Tampilkan juga di console
  if (level === 'error') {
    console.error(logMessage.trimEnd());
  } else {
    console.log(logMessage.trimEnd());
  }

  // Tulis ke file log
  try {
    fs.appendFileSync(getLogFileName(), logMessage);
  } catch (err) {
    console.error("Gagal menulis log ke file", err);
  }
};

const log = {
  info: (...args) => writeLog('info', ...args),
  error: (...args) => writeLog('error', ...args),
  warn: (...args) => writeLog('warn', ...args),
  debug: (...args) => writeLog('debug', ...args),
};

const cleanupOldLogs = () => {
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  
  try {
    const files = fs.readdirSync(logDir);
    files.forEach(file => {
      if (file.endsWith('.txt')) {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > ONE_WEEK_MS) {
          fs.unlinkSync(filePath);
          writeLog('info', `Log lama dihapus: ${file}`);
        }
      }
    });
  } catch (err) {
    writeLog('error', `Gagal menghapus log lama: ${err.message}`);
  }
};

module.exports = {
  ...log,
  cleanupOldLogs
};
