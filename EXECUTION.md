# Margn — Rencana Eksekusi 4 Hari

**Dibuat:** 23 Juli 2026 · **Deadline:** 27 Juli 23:59 UTC = **28 Juli 06:59 WIB**
**Ide yang dikirim:** `MARGN-VERIFIED.md` (pemeriksaan pra-pembelian sisi pembeli)
**Tim:** Diaz · Sako

---

## 0. Aturan main

**Batasan keras yang menentukan pembagian tugas:**

- Wallet OKX, CLI `onchainos` v4.3.0, dan agent #7520 ada di **mesin Diaz**. Semua
  perintah `onchainos agent *` hanya bisa Diaz.
- Data scan (985 agent · 2.344 service · tabel 8-dari-8 · probe 300 endpoint) ada
  di **scratchpad sesi Diaz**. Direktori sementara. Bisa hilang. Hanya Diaz yang
  bisa menyelamatkannya.
- Sisanya — endpoint, aset listing, teks — tidak menyentuh keduanya, jadi Sako
  bisa jalan penuh sejak menit pertama.

**Satu aturan yang tidak boleh dilanggar:** jangan pernah dua orang menyentuh file
yang sama. Pembagian di bawah sudah dipisah per direktori.

| Milik Diaz | Milik Sako |
| --- | --- |
| `research/marketplace-scan/**` | `endpoint/**` |
| `docs/demo/**` | `assets/**` |
| `MARGN-VERIFIED.md` | `docs/listing.md` |

---

## 1. Yang sudah terverifikasi (jangan diperdebatkan lagi)

Dicek langsung ke CLI dan marketplace, 23 Juli 2026:

| Temuan | Bukti |
| --- | --- |
| Boleh daftar ASP | `pre-check --role asp` → `canCreate: true`, `aspCount: 0` |
| Boleh >1 ASP per wallet | `uniqueness: "multiple"` — jaring pengaman kalau gagal |
| **`fee: "0"` lolos review** | agent 6711 `Live Tokenized Stock Quote` · 2162 `Internet Court MCP API`, keduanya A2MCP fee `0` |
| **A2MCP bukan server MCP** | endpoint terdaftar berbentuk REST biasa: `/audit`, `/analyze`, `/v1/quote` |
| Subdomain platform lolos | `onrender.com` dan `dpdns.org` ada di listing approved |
| Dua gerbang, bukan satu | QA jalan di `create`/`update` (instan) · antrean approval di `activate` |
| `update` memicu QA ulang | setelah approved, **jangan sentuh `agent update`** |
| #7520 tidak bisa dipakai | `Role: User`, terkunci saat create |

**Konsekuensi praktis:** tidak ada x402, tidak ada MCP handshake, tidak ada dompet
di endpoint. Cukup HTTPS yang menerima POST dan membalas JSON. Pekerjaannya kecil.

### Yang BELUM terverifikasi

Aturan berikut ada di dokumen tapi tidak muncul di CLI v4.3.0. Tetap patuhi
(murah), tapi jangan kaget kalau pesan errornya beda:

- avatar rasio 1:1 · nama 3–25 karakter · deskripsi ≤500 karakter
- deskripsi layanan dua baris, masing-masing ≤200 karakter
- `validate-listing` — **perintah ini tidak ada di CLI**

---

## 2. Kontrak antar-jalur — sepakati SEBELUM mulai

Ini yang membuat kerja paralel tidak tabrakan. Kunci sekarang, jangan diubah
sepihak.

### 2.1 Skema data harga (Diaz produksi → Sako konsumsi)

Diaz menulis file ini. Sako membacanya. Path dan bentuknya final:

```
endpoint/data/market-snapshot.json
```

```json
{
  "captured_at": "2026-07-22T00:00:00Z",
  "source": "union 44 query onchainos agent search",
  "services": [
    {
      "agent_id": "3152",
      "service_name": "Crypto News Feed",
      "service_type": "A2MCP",
      "fee": 0.55,
      "endpoint": "https://example.com/news",
      "sold_count": 1,
      "feedback_rate": 0.0,
      "security_rate": 2.0
    }
  ]
}
```

`feedback_rate` dan `security_rate` boleh `null` — 75% pasar memang null, dan
endpoint harus menanganinya tanpa crash.

**Agar Sako tidak menunggu:** Sako membuat `endpoint/data/market-snapshot.json`
berisi **5 baris fixture buatan** hari ini juga, lalu membangun di atasnya. Saat
Diaz menaruh file asli di path yang sama, tidak ada kode yang perlu berubah.

### 2.2 Kontrak API (Sako produksi → Diaz daftarkan)

Tiga endpoint terpisah, satu per service — meniru pola listing yang sudah lolos
review di pasar (`/v1/plan`, `/v1/quote`, dst).

```
POST https://<domain>/v1/verify   {"agentId": "3152"}
POST https://<domain>/v1/quote    {"need": "crypto news"}
POST https://<domain>/v1/check    {"agentId": "3152", "price": 0.55}
```

**Response `verify`:**
```json
{
  "agent_id": "3152",
  "alive": true,
  "http_status": 402,
  "interpretation": "healthy — endpoint is live and asking for payment",
  "latency_ms": 412,
  "probed_at": "2026-07-23T10:04:11Z"
}
```

**Response `quote`:**
```json
{
  "need": "crypto news",
  "matches": 7,
  "price_min": 0.001,
  "price_median": 0.05,
  "price_max": 0.55,
  "snapshot_date": "2026-07-22",
  "note": "prices from snapshot; liveness is never cached"
}
```

**Response `check`:** gabungan keduanya + satu field
`"price_position": "3.2x above median"`.

**Aturan yang mengikat implementasi:**

- Probe pakai **POST**, bukan GET. Riset kita menemukan sebagian `405` itu
  endpoint POST-only yang salah diprobe. Jangan ulangi kesalahan itu.
- Pemetaan status: `402` = sehat · `200` = hidup tapi tidak menagih · `4xx`
  lain = mencurigakan · timeout/DNS = tidak terjangkau.
- **Timeout keras 5 detik.** Kalau endpoint tujuan menggantung, Margn tetap
  membalas JSON bersih. Kegagalan hulu tidak boleh jadi kegagalan kita — reviewer
  yang kena request menggantung akan menolak listing.
- Jangan pernah membalas 500. Error apa pun → 200 dengan field `error`.
- Liveness **tidak boleh di-cache**. Harga boleh.
- Jangan pernah memakai kata "terbaik" di response mana pun. Tampilkan rentang.

### 2.3 Titik temu

| Join | Butuh apa | Memblokir apa |
| --- | --- | --- |
| **J1** ✅ | Kontrak §2.1 + §2.2 disepakati | Semua pekerjaan |
| **J2** | Deploy oleh Diaz (D3) → URL final + probe luar oleh Sako (S3) | Pendaftaran ASP (D4) |
| **J3** | Endpoint live + footage (Diaz) | Rekaman demo |

Sejak deploy pindah ke Diaz, **J2 bukan lagi serah-terima antar-orang** — Diaz
bisa jalan sampai `activate` tanpa menunggu Sako. Probe luar S3 sebaiknya tetap
dilakukan sebelum `create`, tapi kalau Sako tidak tersedia, satu probe manual
dari HP (bukan dari laptop yang sama) sudah cukup untuk menutup risiko utamanya.

---

## 3. DIAZ — jalur bukti dan identitas

### D1. Selamatkan data scan · **prioritas nol** · ~1 jam

Seluruh bukti submission ada di direktori sementara. Kalau hilang: demo hilang,
`quote()` kehilangan sumber data, dan pertanyaan juri "bisa saya reproduksi?"
tidak terjawab. Bandingkan: benchmark Sako punya CSV 153 KB tersimpan rapi di
repo; scan kamu tidak punya apa-apa.

Buat `research/marketplace-scan/` lalu commit:

- [ ] script scan (44 query) dan script probe endpoint — apa adanya, jangan dirapikan dulu
- [ ] raw output JSON/CSV hasil 22 Juli, jangan diedit
- [ ] `market-snapshot.json` sesuai skema §2.1 → salin juga ke `endpoint/data/`
- [ ] `README.md`: daftar 44 query, aturan dedup, timestamp, cara menjalankan ulang
- [ ] tabel 8-dari-8 sebagai CSV, bukan cuma di markdown

> Kalau data sudah telanjur hilang: **bilang ke Sako sekarang juga**, jangan
> diam. Scan ulang butuh ~2 jam dan angkanya akan bergeser dari yang tertulis di
> `MARGN-VERIFIED.md` — seluruh dokumen harus diselaraskan ulang, dan itu
> mengubah rencana hari ini.

### D2. Rekam footage `asp-match` mentah · ~1 jam

Buktimu punya masa kadaluarsa. Satu peserta menghapus listing, satu ASP mati, dan
tabel 8-dari-8 berubah — demo kamu bohong tanpa kamu sadari.

- [ ] rekam layar penuh `asp-match` untuk kedelapan kebutuhan, satu per satu
- [ ] jangan dipotong, jangan di-zoom saat merekam (zoom belakangan saat edit)
- [ ] simpan ke `docs/demo/raw/` dengan nama `YYYYMMDD-HHMM-<query>.mp4`
- [ ] verifikasi ulang: apakah tabel 8-dari-8 masih benar hari ini? Kalau ada yang
      bergeser, **perbaiki angkanya di `MARGN-VERIFIED.md`**, jangan biarkan
- [ ] catat versi CLI dan timestamp di `docs/demo/raw/README.md`

### D3. Deploy endpoint · **pindah dari Sako** · ~20 menit

Deploy semula masuk S1. Dipindah ke Diaz karena ini soal kepemilikan akun,
bukan pembagian kerja: URL Workers berbentuk `margn.<subdomain-akun>.workers.dev`,
subdomain itu milik akun Cloudflare yang dipakai deploy, dan URL-nya **permanen
on-chain**. Kalau di-deploy dari akun Sako, identitas ASP menggantung selamanya
pada akun orang lain — dan memperbaikinya butuh `agent update` yang memicu QA
ulang. Endpoint permanen harus satu atap dengan wallet dan identitas ASP.

Sekaligus menghapus satu serah-terima dari jalur kritis: kode Sako sudah
ter-commit, jadi kamu tidak perlu menunggu siapa pun.

```bash
# akun Cloudflare gratis, lalu dari endpoint/
npx wrangler login
npx wrangler deploy
```

- [ ] **Kunci nama worker sebelum deploy.** `wrangler.jsonc` sekarang `name: "margn"`
      — nama itu jadi bagian URL permanen. Mau ganti? Ganti sekarang.
- [ ] **Jangan beli domain.** Subdomain platform terbukti lolos review
      (`signalforge-ai.onrender.com`, `onchainlens.dpdns.org` sudah approved).
      Membeli domain menaruh propagasi DNS di jalur kritis malam ini demi
      skenario pindah hosting yang mungkin tidak pernah terjadi.
- [ ] Catat URL final, isikan ke tiga tempat `<final-domain>` di `docs/listing.md`
- [ ] Kabari Sako supaya S3 bisa jalan

### D4. Daftarkan ASP · setelah J2 · ~1 jam

Urutan pasti, jangan diloncat:

```bash
onchainos agent pre-check --role asp           # sudah: canCreate true

onchainos agent upload --file assets/avatar.png
# → salin URL CDN yang dikembalikan

onchainos agent create --role asp \
  --name "<dari docs/listing.md>" \
  --description "<dari docs/listing.md>" \
  --picture "<URL CDN>" \
  --service '[
    {"serviceName":"...","serviceDescription":"...","serviceType":"A2MCP","fee":"0","endpoint":"https://<domain>/v1/verify"},
    {"serviceName":"...","serviceDescription":"...","serviceType":"A2MCP","fee":"0","endpoint":"https://<domain>/v1/quote"},
    {"serviceName":"...","serviceDescription":"...","serviceType":"A2MCP","fee":"0","endpoint":"https://<domain>/v1/check"}
  ]'

onchainos agent activate --agent-id <ID> --preferred-language en-US
```

- [ ] **Ketiga service didaftarkan sekaligus.** Jangan bertahap — menambah service
      lewat `update` memicu QA ulang, dan siklus kedua tidak muat di 4 hari.
- [ ] Pastikan endpoint sudah live dan sudah diprobe Sako dari luar **sebelum**
      `create`. URL bersifat permanen on-chain.
- [ ] Setelah `activate`, screenshot status pending + simpan hash transaksi ke
      `docs/demo/proof/`. Ini bukti kamu tidak terlambat kalau antrean macet.
- [ ] **Setelah approved, jangan pernah jalankan `agent update`.**

### D5. Rekam demo 90 detik · 26 Juli · ~3 jam

Ikuti §5 `MARGN-VERIFIED.md`, dengan dua koreksi:

- [ ] **Buang beat "55,5% tidak pernah menjual".** Pasar ini baru dan sedang penuh
      agent hackathon — nol penjualan di pasar berumur beberapa hari itu wajar,
      bukan kegagalan pasar. Satu juri jeli mematahkannya dalam satu kalimat, dan
      begitu satu angka jatuh, sisanya ikut diragukan. Ganti dengan tabel
      8-dari-8 yang tidak bisa dibantah.
- [ ] **Ganti framing "rusak" jadi "lapisan yang belum ada".** Serangan paling
      mungkin: *"asp-match memang cuma matcher semantik, ranking bukan tugasnya."*
      Kalau kamu bilang "rusak", kamu kalah argumen itu. Kalau kamu bilang
      "retrieval-nya selesai, ranking-nya belum lahir", kamu menang.
- [ ] Terminal asli, tanpa slide. Sebut ASP lain pakai ID saja, jangan nama.
- [ ] Jangan sembunyikan latensi probe.

---

## 4. SAKO — jalur endpoint dan listing

Tidak menyentuh wallet, CLI, atau data Diaz. Bisa mulai sekarang juga.

### S1. Endpoint · ~4 jam · ✅ **SELESAI**

Tanpa x402, tanpa MCP, tanpa database, tanpa auth, tanpa state.

- [x] `endpoint/` — tiga route POST sesuai kontrak §2.2
- [x] `endpoint/data/market-snapshot.json` — **data asli**, bukan fixture:
      2.439 layanan · 973 agent · `captured_at 19:55:23`
- [x] `verify` = probe POST nyata, timeout 5 detik, `cache-control: no-store`
- [x] `quote` = tokenisasi + pencocokan, kembalikan min/median/maks
- [x] `check` = komposisi keduanya + `price_position`
- [x] `feedback_rate`/`security_rate` bernilai `null` ditangani

Terverifikasi dengan menjalankannya: **46 test lulus**, `tsc --noEmit` bersih,
build 2.331 KiB → **gzip 417 KiB** (limit Workers free 3 MiB, jadi aman).
Catch-all mengembalikan `INTERNAL_ERROR` sebagai JSON 200 — tidak pernah 500.

**Host:** Cloudflare Workers, **di-deploy oleh Diaz** (lihat D3) — akun harus
satu atap dengan wallet karena URL permanen on-chain.

**Domain: tidak dibeli.** Pakai `margn.<subdomain-akun>.workers.dev`.

**Batas desain yang harus disadari:** `verify()` hanya memprobe endpoint yang ada
di snapshot. Ini pilihan keamanan yang benar — tanpa itu Margn jadi alat SSRF
gratis. Konsekuensinya: agent yang mendaftar setelah snapshot terakhir
mengembalikan `AGENT_NOT_FOUND`, dan Margn tidak bisa memverifikasi dirinya
sendiri. Pasar tumbuh ~5 agent per 20 menit. Mitigasi cukup dengan refresh
snapshot di hari demo dan hari submission — tidak perlu ubah kode.

### S2. Aset listing · ~2 jam · ✅ **SELESAI**

- [x] `assets/avatar.png` — **1254×1254, rasio 1:1**
- [x] `docs/listing.md` — nama `Margn` (5/25), deskripsi 258/500, tiga deskripsi
      service dua-baris: 126/32 · 101/52 · 100/51 (limit 200)
- [x] `scripts/validate-listing.mjs` — dibuat Sako untuk menggantikan
      `validate-listing` yang ternyata tidak ada di CLI v4.3.0. Lolos.

Tersisa: tiga `<final-domain>` di `docs/listing.md` diisi setelah D3.

### S3. Pengerasan · **setelah Diaz deploy (D3)** · ~1 jam

Edge case sudah tertutup 46 test lokal. Yang tersisa butuh URL hidup:

- [ ] probe ketiga endpoint **dari jaringan luar**, berkali-kali, sampai bosan
- [ ] uji dengan `agentId` tidak ada, `need` kosong, body bukan JSON
- [ ] uji `verify` terhadap endpoint yang sengaja lambat → harus putus di 5 detik
- [ ] kabari Diaz: **"URL sehat, siap didaftarkan"**

### S4. Dua utang dari review · tidak memblokir siapa pun

- [ ] **`npm ci` gagal** — lockfile tidak sinkron, empat paket `@emnapi` hilang.
      Checkout bersih tidak bisa install; juri yang mencoba akan tersandung.
      Perbaikannya sudah ada di working tree (hasil `npm install`), tinggal commit.
- [ ] siapkan refresh `market-snapshot.json` untuk hari demo dan hari submission —
      jalankan `scan.py` lalu `build-snapshot.mjs`. Menukar file JSON di balik URL
      tidak menyentuh registry sama sekali.

---

## 5. Linimasa

| Hari | Diaz | Sako | Titik temu |
| --- | --- | --- | --- |
| **23 Jul** | ✅ D1 scan ter-commit | ✅ S1 endpoint + ✅ S2 aset | ✅ J1 |
| **23 Jul malam** | **D3 deploy → D4 create + activate** · D2 rekam footage | S3 setelah URL hidup | **J2 — antrean dimasuki hari ini** |
| **24 Jul** | susun naskah demo, cek ulang angka | S4 utang review | — |
| **25 Jul** | **buffer** — kalau ditolak, perbaiki dan daftar ulang (`uniqueness: multiple`) | buffer | — |
| **26 Jul** | D5 rekam + edit demo, posting X `#OKXAI` | refresh snapshot, bantu edit | J3 |
| **27 Jul** | submit Google Form **pagi hari** | verifikasi akhir | — |

**Jalur kritis malam ini, tanpa satu pun serah-terima:**

```
wrangler deploy → catat URL → isi listing.md → probe dari luar
→ agent upload avatar → agent create → agent activate
```

Kamu punya satu pagi ekstra (deadline = 28 Juli 06:59 WIB). **Pakai untuk buffer,
bukan untuk fitur.**

---

## 6. Kalau ada yang meleset

| Kejadian | Tindakan |
| --- | --- |
| Data scan hilang | Diaz kabari Sako **sekarang**. Scan ulang ~2 jam, lalu selaraskan semua angka di `MARGN-VERIFIED.md`. Jangan biarkan dokumen memuat angka yang tidak bisa direproduksi. |
| `create` ditolak QA | Bagus — ketahuan seketika, bukan setelah 3 hari. Perbaiki teks/avatar, ulangi. Belum masuk antrean. |
| `activate` ditolak reviewer | `uniqueness: multiple` → boleh buat ASP kedua. Perbaiki penyebabnya, daftar lagi. Jangan panik pakai wallet baru. |
| Antrean tidak selesai sampai 27 Juli | Tetap submit. Video, tabel 8-dari-8, repo bukti, dan post X semuanya jalan **tanpa** listing — demo berjalan di mesin sendiri. Sertakan screenshot pending + hash transaksi. Datang dengan bukti lengkap dan satu checkbox tertahan di pihak mereka jauh berbeda dari datang kosong. |
| Endpoint mati saat demo | Rekam demo dari footage tersimpan, bukan siaran langsung. |
| Tabel 8-dari-8 berubah | Perbaiki angkanya, jangan pertahankan yang lama. Juri bisa mengecek dengan satu perintah; satu angka salah menghabiskan kredibilitas seluruh dokumen. |

---

## 7. Cek terakhir sebelum submit

- [ ] Tidak ada angka lama dari `MARGN-v2` / `MARGN-ROUTER` di mana pun (47%, 39%, 34% — semuanya salah)
- [ ] Setiap angka di dokumen bisa direproduksi dari `research/marketplace-scan/`
- [ ] ASP status approved, atau bukti pending tersimpan bertanggal
- [ ] Ketiga endpoint hidup dan sudah diprobe dari luar
- [ ] Demo ≤90 detik, terminal asli, ASP lain disebut pakai ID
- [ ] Tidak ada klaim "terbaik" — di response endpoint maupun di demo
- [ ] Tidak ada klaim "kami memperbaiki OKX" — yang benar: "kami membaca sinyal yang sudah ada di sana"
- [ ] Post X sudah tayang dengan `#OKXAI`
- [ ] Form disubmit pagi 27 Juli, bukan menit terakhir
