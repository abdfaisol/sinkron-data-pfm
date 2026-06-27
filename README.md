# Sinkron Data ERP

Project ini adalah layanan Node.js (*backend*) yang bertugas melakukan sinkronisasi data master secara otomatis (maupun manual) dari API eksternal (ERP Midsuit) ke dalam *database* PostgreSQL internal.

## Fitur Utama

- **Sinkronisasi Organisasi**: Menarik data organisasi dan memasukkannya ke database lokal (`m_organization`).
- **Sinkronisasi Struktur Organisasi**: Menarik struktur dari setiap organisasi yang ditarik, lalu menyimpan hierarki induk-anak (parent-child).
- **Sinkronisasi Posisi / Jabatan**: Menarik daftar pekerjaan dari setiap organisasi dan menghubungkannya dengan departemen yang bersangkutan.
- **Sinkronisasi Karyawan**: Menarik data detail karyawan, mencatatnya ke dalam `m_employee`, lalu melakukan *upsert* pada tabel `m_user` untuk mengelola kredensial login (di-_hash_ menggunakan `bcrypt.js`).
- **Pemetaan Role / Peran Karyawan**: Mengatur relasi hirarki _role_ (*employee*, *manager*, *hrd*) di tabel `m_user_role`.
- **Logger Otomatis**: Semua aktivitas, proses _sync_, dan _error_ akan tersimpan rapi ke dalam folder `log/` dengan format file per-tanggal (`YYYY-MM-DD.txt`).

## Prasyarat

- **Node.js** (v18+)
- **PostgreSQL** Database
- **Prisma CLI**

## Konfigurasi dan Instalasi

1. **Install dependensi**  
   Buka terminal di dalam direktori project dan jalankan:
   ```bash
   npm install
   ```

2. **Atur variabel lingkungan (Environment Variables)**  
   Ubah atau pastikan file `.env` memiliki pengaturan URL Database Anda.
   ```env
   DATABASE_URL="postgresql://username:password@host:port/database_name?schema=public"
   ```

3. **Generate Prisma Client**  
   Karena proyek ini bergantung pada Prisma, jalankan _generate_ untuk mendapatkan library `@prisma/client` lokal:
   ```bash
   npx prisma generate
   ```

4. **Menjalankan Aplikasi**  
   - Mode Development (menggunakan Nodemon):
     ```bash
     npm run dev
     ```
   - Mode Production:
     ```bash
     npm start
     ```

## Penggunaan

Setelah aplikasi (Express) berjalan, *server* akan *standby* di `http://localhost:3000`.

- Untuk memicu proses sinkronisasi secara manual, buka URL berikut di *browser* atau gunakan *Postman*/*CURL*:
  `GET http://localhost:3000/sinkron`

Selama proses sinkronisasi berjalan, Anda dapat memantau *progress* secara detail baik dari konsol terminal maupun dari file *log* (`log/YYYY-MM-DD.txt`).

---
_Dibuat dengan Prisma ORM dan Express.js_
