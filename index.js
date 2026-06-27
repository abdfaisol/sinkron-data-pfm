const express = require('express');
const path = require('path');
const log = require('./logger');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/log', express.static(path.join(__dirname, 'log')));

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ status: 'error', message: 'Username dan password wajib diisi' });
    }

    const user = await prisma.m_user.findFirst({
      where: { username }
    });

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    let isValid = false;
    try {
      const bcryptModule = require('./bcrypt.js');
      isValid = bcryptModule.compareSync(password, user.password);
    } catch (e) {
      log.error("Bcrypt compare error:", e.message);
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      isValid = (hash === user.password);
    }

    if (isValid) {
      res.json({ status: 'success', message: 'Login berhasil!', data: { username: user.username, name: user.name } });
    } else {
      res.status(401).json({ status: 'error', message: 'Password salah' });
    }
  } catch (error) {
    log.error("Login route error:", error.message);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan internal server' });
  }
});

const { runFullSync } = require('./sync');

// Endpoint untuk memicu sinkronisasi secara manual
app.get('/sinkron', async (req, res) => {
  try {
    // Misalnya token didapat dari header Authorization atau env variable
    // Untuk contoh kita asumsikan dikirim via query ?token=... atau env
    const token = req.query.token || process.env.MIDSUIT_TOKEN || 'DUMMY_TOKEN';
    
    const result = await runFullSync(token);
    res.json(result);
  } catch (error) {
    log.error('Error saat sinkronisasi:', error);
    res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat sinkronisasi' });
  }
});

const cron = require('node-cron');

// Jadwal Cron: Setiap jam 00:00 malam lakukan sinkronisasi otomatis
cron.schedule('0 0 * * *', async () => {
  log.info("CRON: Menjalankan sinkronisasi otomatis harian (00:00)");
  try {
    await runFullSync();
  } catch (error) {
    log.error("CRON: Error saat sinkronisasi otomatis:", error.message);
  }
});

// Jadwal Cron: Setiap jam 01:00 pagi lakukan penghapusan log lebih dari 1 minggu
cron.schedule('0 1 * * *', () => {
  log.info("CRON: Menjalankan pengecekan dan penghapusan log lama (01:00)");
  log.cleanupOldLogs();
});

app.listen(port, () => {
  log.info(`Server berjalan di http://localhost:${port}`);
  log.info(`Panggil http://localhost:${port}/sinkron untuk menjalankan sinkronisasi data`);
});
