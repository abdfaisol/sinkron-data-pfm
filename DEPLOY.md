# Panduan Deployment ke VPS (Linux/Ubuntu)

Langkah-langkah ini diasumsikan menggunakan sistem operasi Linux (Ubuntu/Debian) yang umum digunakan untuk VPS.

## 1. Persiapan VPS
Pastikan VPS Anda sudah terinstal **Node.js** dan **PM2**. Jika belum, jalankan perintah ini di terminal VPS Anda:

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js (misal: versi 18)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 secara global
sudo npm install pm2 -g
```

## 2. Pindahkan Kode ke VPS
Ada 2 cara paling umum untuk memindahkan *code* Anda:
- **Cara A (Git)**: Push *code* Anda ke GitHub/GitLab (gratis dan *private*), lalu jalankan `git clone <url-repo>` di dalam VPS.
- **Cara B (SFTP/FileZilla)**: Zip folder `sinkron-data` (tanpa folder `node_modules`), pindahkan ke VPS menggunakan FileZilla / SCP, lalu *extract* (*unzip*) di sana.

## 3. Konfigurasi Proyek
Setelah masuk ke folder proyek di dalam VPS, lakukan instalasi:

```bash
# Masuk ke folder proyek
cd sinkron-data

# Install seluruh modul Node.js
npm install
```

## 4. Buat File Environment (`.env`)
Karena `.env` tidak ikut dipindah (jika menggunakan Git), Anda wajib membuatnya kembali di VPS:

```bash
nano .env
```
Isi dengan pengaturan *database* Anda yang bisa diakses oleh VPS (entah *database*-nya ada di VPS yang sama atau VPS lain):
```env
PORT=3000
DATABASE_URL="postgresql://username:password@host:port/database_name?schema=public"
```
Simpan file (di Nano: tekan `CTRL+X`, lalu `Y`, lalu `Enter`).

## 5. Generate Prisma
Setelah file `.env` selesai, wajib jalankan perintah *generate* agar Prisma mengenali *database* di server Linux (karena mesin lokal Anda Windows, Prisma *engine*-nya berbeda).

```bash
npx prisma generate
```

## 6. Jalankan Aplikasi dengan PM2
Karena file `ecosystem.config.js` sudah disiapkan, Anda cukup menjalankannya:

```bash
pm2 start ecosystem.config.js
```

## 7. Auto-Start PM2 (Opsional tapi Penting)
Agar saat VPS di-*restart* aplikasinya otomatis nyala, jalankan perintah ini:

```bash
# Membuat startup script
pm2 startup

# (CATATAN: pm2 startup akan mengeluarkan sebuah perintah `sudo env PATH...` di layar. 
# Copy perintah tersebut, lalu paste dan tekan Enter di terminal Anda).

# Simpan state saat ini
pm2 save
```

## 8. Selesai!
Aplikasi Anda sudah berjalan. 
- Untuk memantau log: `pm2 logs sinkron-data`
- Untuk mengecek status: `pm2 status`
- Untuk melakukan sinkronisasi, Anda kini bisa memanggil URL VPS Anda, contohnya: `http://IP-VPS-ANDA:3000/sinkron`.
