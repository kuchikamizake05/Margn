# Ide 2: Margn — The Margin Engine for Agent Service Providers

> **Your ASP knows its revenue to the cent. It has no idea what a call costs.
> Margn closes that gap — and tells you the price below which you're working for free.**

---

## 1. The insight

Di OKX.AI, sisi **pendapatan** seorang ASP presisi sempurna: x402 menyelesaikan
pembayaran per call, on-chain, di XLayer. Bisa diaudit sampai desimal terakhir.

Sisi **biaya** sepenuhnya gelap. Biaya riil satu call adalah:

- token LLM (input + output, sering dengan context yang membengkak diam-diam)
- inference / compute
- **retry** — call yang gagal lalu diulang, membakar token dua kali
- **call gagal yang tetap berbiaya** — error setelah token terlanjur terpakai
- tool call bersarang ke API berbayar lain

Tidak satupun dari ini muncul on-chain. Akibatnya ASP tahu revenue-nya persis,
dan gross margin-nya tidak sama sekali.

### Kenapa ini gawat *sekarang*, bukan nanti

Mereka tidak sedang salah menetapkan harga karena malas. Mereka menetapkan harga
sebelum ada satupun data biaya yang bisa dilihat.

---

## 1b. Bukti empiris dari marketplace hidup

> **Scan nyata, 21 Juli 2026** — `onchainos agent search` di 10 kategori.
> **119 agent unik, 477 layanan, 21.283 total penjualan.** Semua angka di bawah
> ini publik dan bisa direproduksi siapa pun tanpa izin siapa pun.

**Koreksi atas asumsi awal.** Aku sebelumnya menyimpulkan harga menggumpal di
$0.003–0.005 dan belum ada kedalaman untuk membuat benchmark. **Keduanya salah.**
Sebaran harga nyata membentang **lima orde besaran**, dari $0.000001 sampai $0.5,
dengan modus di $0.01 (112 layanan). 477 layanan berharga publik lebih dari cukup
untuk benchmark lintas-ASP. Yang memang tipis adalah data *permintaan* deret
waktu — bukan data harga.

### Temuan 1 — Volume terkonsentrasi ekstrem

| Agent | Terjual | Pangsa |
| --- | --- | --- |
| PixelBrief | 10.098 | **47,4%** |
| ScoutGate | 1.633 | 7,7% |
| Onchain Data Explorer | 1.588 | 7,5% |
| CoinWM Open API | 1.566 | 7,4% |
| CoinAnk OpenAPI | 1.532 | 7,2% |

Satu agent menguasai hampir separuh seluruh transaksi. **39% agent (46 dari 119)
punya nol penjualan.**

### Temuan 2 — 34% agent sedang offline

41 dari 119 agent berstatus `onlineStatus=0`. Mereka terdaftar, punya harga,
punya endpoint — dan tidak bisa menerima satu sen pun. Terlihat dari luar,
tidak ada yang memberi tahu mereka.

### Temuan 3 — Patologi harga rata, terlihat telanjang

Delapan ASP dengan 5+ layanan memasang **satu harga untuk semuanya**:

| ASP | Layanan | Harga |
| --- | --- | --- |
| CoinAnk OpenAPI | 80 | semua $0.01 |
| Hunch Research | 20 | semua $0.000001 |
| Newsliquid | 13 | semua $0.002 |
| 玄策 AI | 12 | semua $0.5 |
| ChainSentry | 5 | semua $0.05 |

CoinAnk menagih $0.01 untuk `Base Coin Symbols` — sebuah list lookup sepele —
**dan $0.01 yang sama** untuk `Liq Heat Map`, komputasi berat. Satu di antaranya
pasti salah harga, dan hampir pasti keduanya.

Hunch Research menagih $0.000001 per call: **$1 per satu juta panggilan.** Kalau
ada satu saja panggilan LLM di baliknya, itu rugi telak di setiap call.

**Ini bukan hipotesis lagi.** Ini terbaca dari luar, hari ini, tanpa izin,
tanpa instrumentasi, tanpa mock data.

---

## 2. What Margn does

Margn menggabungkan dua sumber data yang belum pernah disatukan siapapun:

```
  REVENUE            ←  on-chain x402 settlement stream (XLayer)
                        trustless, presisi, tidak bisa dibantah
        +
  COST               ←  telemetry ASP itu sendiri (SDK / log)
                        token usage, retry, latency, failure
        ↓
  GROSS MARGIN per call, per service, per counterparty
```

Sisi revenue diambil dari chain sehingga tidak bergantung pada laporan sendiri.
Sisi cost dilaporkan sendiri — dan itu tidak masalah, karena pelanggannya adalah
pihak yang melaporkan biayanya sendiri untuk dirinya sendiri.

### Catatan penting: granularitas on-chain tidak seragam

**Terverifikasi (21 Juli 2026).** x402 menyelesaikan pembayaran sebagai transfer
stablecoin ERC-20. Di X Layer, USDT ada di
`0x1e4a5963abfd975d8c9021ce480b42188849d41d`, dan transfer masuk ke agentic
wallet sebuah ASP terbaca publik lewat OKLink beserta API-nya
(`/api/v5/xlayer/token/transaction-list`).

Tapi OKX Agent Payments Protocol punya **empat skema, dan hanya dua yang
menyentuh chain per call**:

| Skema | Settlement | Terbaca per-call on-chain? |
| --- | --- | --- |
| `exact` | pembayaran on-chain langsung tiap request | Ya |
| `charge` (one-shot) | settle seketika | Ya |
| `aggr_deferred` | banyak call digabung jadi batch | **Tidak** — hanya nettonya |
| `session` + channel | voucher per request diterbitkan **off-chain**; hanya open/close yang on-chain | **Tidak** |

Artinya untuk ASP yang memakai channel, pendapatan per call tidak ada di chain.
Yang ada hanya angka netto saat channel ditutup.

**Ini tidak mematahkan desain, karena Margn memang tidak butuh revenue per-call
dari chain.** Harga per call sudah deterministik — itu harga yang dipasang ASP
sendiri. Yang diberikan chain adalah **verifikasi independen atas total
pendapatan yang benar-benar terselesaikan** dalam satu periode. Margin dihitung
dengan menyandingkan total on-chain itu terhadap total biaya dari telemetry pada
jendela waktu yang sama; granularitas per-call datang dari telemetry × harga.

**Ini titik teknis yang membedakan.** Semua orang membangun ASP yang *mengerjakan
sesuatu*. Tidak ada yang menyambungkan settlement on-chain ke biaya inference
off-chain.

---

## 2b. Batas keras: apa yang bisa dilihat dari luar, apa yang tidak

Terverifikasi langsung lewat CLI (21 Juli 2026, akun `0x95dd…0dbd`, agent #6911):

**Terbaca dari luar, tanpa izin siapa pun** — lewat `agent search` /
`agent profile` / `agent feedback-list` / `agent x402-check`:
harga tiap layanan, tipe layanan (A2A/A2MCP), **URL endpoint**, `soldCount`,
rating, `securityRate`, status online, kategori, token pembayaran.

**Terkunci ke akun sendiri** — `agent asp-claimable --agent-id 1` ditolak dengan
`code=3001: agent is not bound to the current user`. Hal yang sama berlaku untuk
`tasks` dan saldo.

**Konsekuensi desain yang tidak bisa ditawar:** Margn **tidak bisa** memindai
marketplace lalu memberi tahu ASP lain bahwa mereka punya dana mengendap. Sudut
`reconcile()` hanya bekerja pada akun yang memanggil Margn untuk dirinya sendiri.

Jadi Margn punya dua lapisan, dan **lapisan luar yang menjual lapisan dalam**:

| Lapisan | Butuh izin? | Isi |
| --- | --- | --- |
| **Tier 1 — Outside-in** | Tidak | Benchmark harga terhadap 477 layanan nyata, deteksi harga rata, endpoint mati, status offline, layanan nol penjualan |
| **Tier 2 — Account-bound** | Ya, ASP memanggil untuk dirinya | `asp-claimable` sweep, escrow belum ditarik, margin vs biaya |

Tier 1 adalah umpan yang bisa ditunjukkan ke ASP mana pun tanpa mereka melakukan
apa-apa. Tier 2 adalah produknya.

---

## 3. Surface produk

### Mode A2MCP (pay-per-call) — untuk query cepat

| Tool | Output |
| --- | --- |
| `getUnitEconomics(service)` | distribusi cost/call (p50/p95/p99), gross margin, % call yang terjual di bawah biaya |
| `getPriceFloor(service, targetMargin)` | **harga minimum yang layak.** "Floor kamu $0.0041. Kamu jual $0.003. Kamu rugi di 61% call." |
| `getMarginLeaks()` | di mana uangnya bocor: retry, context membengkak, satu caller yang terus memukul jalur termahal, call gagal yang tetap berbiaya |
| `simulatePrice(newPrice)` | proyeksi dampak margin sebelum harga diubah |
| `reconcile(period)` | **apakah kamu benar-benar dibayar untuk semua yang kamu kerjakan?** Delapan kelas kebocoran di bawah. |

### `reconcile()` adalah produknya, bukan fiturnya

Setelah membaca skill resmi OKX (`onchainos-skills`, terpasang lokal 21 Juli 2026),
ada **delapan kelas kebocoran pendapatan yang terdokumentasi di dokumen OKX
sendiri**. Semuanya nyata, bukan hipotesis:

**Mode A2MCP (pay-per-call):**

1. **Voucher replay di legacy OKX Rust SDK.** Dokumen: *"Legacy OKX Rust SDK
   treats byte-replay as idempotent retry and **skips the deduct**."* Pembeli
   mengirim ulang voucher yang sama, seller SDK lama tidak memotong, layanan
   tetap diberikan. **Kerja gratis, terdokumentasi.**
2. **Terkirim melebihi cum yang ditandatangani.** Close hanya menyelesaikan
   `final_cum` — cum voucher tertinggi yang pernah ditandatangani. Pekerjaan yang
   dilayani di atas angka itu tidak pernah settle.
3. **Channel tidak pernah ditutup.** Dokumen: saldo tetap terkunci di escrow
   sampai timeout seller, *"typically 12–24h"*.
4. **`aggr_deferred` yang menggantung.** Dokumen: *"status may be `pending` —
   facilitator settles asynchronously, the chain tx appears later."* Tidak ada
   yang memastikan tx itu benar-benar mendarat.
5. **Salah pilih skema.** Ada skema `upto` (metered, bayar sesuai konsumsi nyata
   di bawah cap) dan `subscription`. ASP dengan biaya bervariasi yang memakai
   `exact` flat sedang menanggung seluruh varians biayanya sendiri.

**Mode A2A (escrow task):**

6. **`asp-claimable` tidak pernah ditarik.** Reward ASP **tidak masuk otomatis** —
   menumpuk di level akun dan harus ditarik eksplisit lewat `asp-claim-rewards`.
7. **`claim-auto-complete` tidak pernah dijalankan.** Kalau klien tidak pernah
   me-review, escrow masuk `review_expired` dan ASP harus **menarik dananya
   sendiri**. Kalau tidak, uang mengendap.
8. **Deliver sebelum `job_accepted`.** Peringatan OKX sendiri: *"delivering
   before escrow is funded means working for free."*

### Kenapa ini mengubah segalanya

`onchainos agent asp-claimable --agent-id <id>` adalah **satu panggilan read-only**
yang mengembalikan angka dolar nyata, hari ini, untuk ASP mana pun.

Tanpa instrumentasi. Tanpa telemetry. Tanpa adopsi SDK. Tanpa mock data.

Dan hasilnya tidak bisa didebat. *"Margin kamu tipis"* masih bisa diperdebatkan
asumsinya. *"Kamu punya $47 yang belum kamu tarik"* tidak bisa.

`getPriceFloor` adalah inti produknya. Sisanya adalah dashboard; ini yang membuat
Margn jadi **alat keputusan**, bukan alat pengamatan.

### Mode A2A (escrow) — untuk analisis mendalam

Laporan CFO lengkap: profitabilitas per lini layanan, service mana yang harus
dinaikkan harganya / dibatasi / dimatikan, counterparty mana yang tidak
menguntungkan untuk dilayani, dan rekomendasi struktur harga.

---

## 4. Kenapa ini lolos dari masalah yang membunuh Margn v1

| Masalah v1 | Status di v2 |
| --- | --- |
| Butuh riwayat dispute marketplace — belum ada | **Hilang.** Tidak butuh data marketplace sama sekali. |
| Butuh tren harga per kategori — belum ada | **Hilang.** Price floor dihitung dari struktur biaya sendiri, bukan dari pasar. |
| Wallet scoring bertabrakan dengan CertiK | **Hilang.** Bukan domain security. |
| Dispute prediction bertabrakan dengan GenLayer | **Hilang.** Bukan domain arbitrase. |
| Demo terpaksa pakai mock data | **Hilang.** Semua angka nyata sejak hari pertama. |

Nama "Margn" justru jadi jauh lebih tepat: **margin**, bukan margin call.

---

## 5. Demo (yang jalan dengan data asli)

**Demo tidak butuh dikarang — sudah ada di marketplace, tinggal ditunjukkan.**

1. Margn memindai marketplace hidup: 119 agent, 477 layanan (~20 detik).
2. Tampilkan tiga temuan yang menusuk, semuanya nyata:
   - *"47% seluruh transaksi platform dikuasai satu agent. 39% agent tidak
     pernah menjual apa pun."*
   - *"34% agent sedang offline. Mereka tidak bisa menerima satu sen pun,
     sekarang juga."*
   - *"CoinAnk menagih harga yang sama persis untuk 80 layanan berbeda — dari
     list lookup sepele sampai heat map komputasi berat."*
3. Arahkan Margn ke satu ASP tertentu, tunjukkan kartu diagnosisnya: posisi
   harganya terhadap 477 layanan sebanding, layanan mana yang nol penjualan,
   endpoint mana yang mati.
4. Tutup dengan Margn mendiagnosis dirinya sendiri, terbuka.

Juri OKX bisa memverifikasi setiap angka dengan satu perintah CLI di mesin
mereka sendiri. Tidak ada yang perlu dipercaya begitu saja.

**Kenapa demo ini kuat secara politis:** ia tidak hanya menolong ASP, ia
menunjukkan ke OKX kondisi kesehatan pasar mereka sendiri — konsentrasi ekstrem,
sepertiga suplai mati, harga yang tidak rasional. Itu diagnosis yang mereka
butuhkan dan belum ada yang menyodorkan.

### Momen penutup: Margn mengukur dirinya sendiri

Margn adalah ASP juga. Jadi Margn menjalankan dirinya pada dirinya sendiri dan
mempublikasikan gross margin-nya sendiri secara terbuka. Satu-satunya ASP di
marketplace yang bisa membuktikan dirinya solven.

---

## 6. Fit ke prize track

| Track | Prize | Fit | Alasan |
| --- | --- | --- | --- |
| **Revenue Rocket** | $20.000 | Utama | Secara harfiah menaikkan pendapatan ASP lain — dan bisa dibuktikan dengan angka before/after, bukan proyeksi |
| **Finance Copilot** | $7.500 | Sangat kuat | Ini akuntansi gross margin. Definisi harfiah finance copilot. |
| **Creative Genius** | $20.000 | Sedang | Meta-play "ASP untuk ASP" tetap utuh |

Narasi untuk juri OKX:

> Marketplace hanya sehat kalau penjualnya solven. Sekarang tidak ada satupun
> ASP di OKX.AI yang tahu apakah mereka untung. Margn membuat setiap ASP di
> platform ini bisa melihat margin-nya — dan itu kepentingan OKX, bukan cuma
> kepentingan mereka.

---

## 7. Risiko yang belum selesai

**Friksi instrumentasi.** ~~ASP harus memasang SDK untuk mengirim data biaya.~~
**Sebagian besar teratasi.** Lapisan `reconcile()` tidak butuh instrumentasi sama
sekali — `asp-claimable`, status channel, dan settlement on-chain semuanya
terbaca dari luar. Instrumentasi hanya diperlukan untuk lapisan margin
(`getPriceFloor`), dan itu sekarang jadi fitur lanjutan, bukan syarat masuk.
Artinya Margn punya nilai di detik pertama, sebelum ASP mengubah apa pun.

**Bisa dianggap sekadar dashboard.** Kalau Margn hanya melaporkan angka, nilainya
kecil. Yang menyelamatkannya adalah `getPriceFloor` — sebuah rekomendasi
tunggal yang bisa langsung dieksekusi.

**Perlu ASP lain untuk punya nilai.** Basis penggunanya adalah ASP, dan ASP di
platform ini masih sedikit (~50 dari closed beta + gelombang hackathon).
*Justru menguntungkan:* gelombang hackathon ini sendiri adalah kohort pengguna
pertama Margn, dan semuanya sedang menetapkan harga secara buta minggu ini.

---

## 8. Yang perlu diverifikasi sebelum menulis kode

**Sudah terverifikasi (21 Juli 2026):**

- Settlement x402 terbaca publik di X Layer sebagai transfer ERC-20; USDT di
  `0x1e4a5963abfd975d8c9021ce480b42188849d41d`, dibaca lewat OKLink API
  `/api/v5/xlayer/token/transaction-list`
- Granularitas tidak seragam antar skema — lihat tabel di bagian 2
- Tiap pembayaran mengembalikan header `PAYMENT-RESPONSE` berisi tx hash, dan
  bisa diurai lewat `onchainos payment decode-receipt`. Jadi ASP punya resi
  lokal per pembayaran yang bisa disilangkan Margn terhadap chain — ini bahan
  mentah untuk `reconcile()`.

**Terverifikasi lewat skill resmi OKX** (repo `github.com/okx/onchainos-skills`,
terpasang di `~/.claude/skills/`, CLI `onchainos` v4.2.6 sudah ada di mesin):

- `channelId = keccak256(abi.encode(payer, payee, token, salt, authorizedSigner,
  escrow, chainId))` — deterministik dan bisa dihitung ulang. Escrow memancarkan
  event on-chain saat open; seller membandingkan channelId terhadap event itu.
- Escrow **bukan singleton global** — alamatnya datang per-challenge dari
  `methodDetails.escrowContract`, jadi harus ditemukan per counterparty.
- Ada **enam** skema, bukan empat: `exact`, `exact`+Permit2, `upto`,
  `aggr_deferred`, `charge`, `subscription`.
- Sisi ASP punya perintah CLI read-only yang langsung berguna:
  `agent asp-claimable`, `agent asp-claim-rewards`, `agent claim-auto-complete`,
  `agent tasks`, `agent active-tasks`, `agent feedback-list`.
- Reputasi ERC-8004 terbaca lewat `agent feedback-list --agent-id <N>`
  (skor 0.00–5.00, reviewer, peran, tanggal, task hash).

**Masih terbuka — dan yang satu ini menentukan:**

- ⚠️ **Belum terbukti bahwa ASP nyata punya saldo yang belum ditarik — dan
  kemungkinan besar TIDAK BISA dibuktikan dari luar.** `asp-claimable` ditolak
  lintas akun (`code=3001`). Di akun sendiri (#6911, nol transaksi) hasilnya
  USDT/USDG/OKB semuanya `0.000000` — sesuai harapan untuk akun kosong, jadi
  ini bukan bukti apa-apa ke arah mana pun.
  **Konsekuensinya: Tier 2 tidak bisa divalidasi sebelum ada ASP nyata yang
  bersedia menjalankannya.** Karena itu Tier 1 (outside-in) harus jadi tulang
  punggung submission, bukan Tier 2.
**Terjawab pada scan kedua (140 agent) — dan ini mengoreksi catatan sebelumnya:**

- **Reputasi TERNYATA punya daya pembeda.** Klaim "semua rating 100.0" tadi
  adalah artefak sampel kecil. Pada 140 agent: `feedbackRate` punya 14 agent di
  bawah 100 (menyebar 0.0 · 50.0 · 66.67 · 72.73 · 89.47 · 90.0 · 92.86 · 94.87 ·
  95.45×2 · 95.6 · 96.67 · 97.1), dan **`securityRate` menyebar jauh lebih lebar —
  21 agent di bawah 5.0, rentang 1.0 sampai 4.89.** `securityRate` adalah sinyal
  kualitas yang paling berguna di platform ini sekarang. Rating muncul persis
  bersamaan dengan penjualan pertama (78/140 punya rating, 78/140 punya >0 sales).
  Belum cukup untuk prediksi dispute, tapi cukup untuk menandai outlier.
- **Akses on-chain: beres, dan tidak butuh OKLink.** OKLink menolak tanpa
  `OK-ACCESS-KEY` (HTTP 401, perlu daftar key gratis). Tapi **public RPC
  `https://rpc.xlayer.tech` menjawab tanpa auth sama sekali** (`eth_blockNumber`
  → blok 65.821.180). `eth_getLogs` atas event Transfer sudah cukup untuk membaca
  sisi pendapatan — tanpa API key, tanpa rate limit pihak ketiga. URL dokumentasi
  yang tadi bersertifikat kedaluwarsa ternyata hanya redirect; tujuannya
  `web3.okx.com/onchainos/dev-docs/data/xlayer-introduction/` normal.
- **Registrasi ASP di wallet ini diizinkan.** `pre-check --role asp` →
  `canCreate: true`, `uniqueness: "multiple"`, `aspCount: 0`. Artinya wallet yang
  sama boleh memegang agent User (#6911) **dan** agent ASP sekaligus — ini yang
  membuka jalan uji-mandiri Tier 2 di bawah.

### Rencana uji Tier 2 (self-contained, tanpa perlu ASP lain)

1. Daftarkan agent ber-peran ASP di wallet yang sama.
2. User #6911 membuat task dan menunjuk ASP milik sendiri.
3. `set-payment-mode` → `confirm-accept` → escrow terisi.
4. ASP menjalankan `deliver`.
5. User **sengaja tidak** meng-konfirmasi → tunggu `review_expired`.
6. `asp-claimable` → apakah reward muncul sebagai pending?
7. `claim-auto-complete` / `asp-claim-rewards` → apakah dananya bergerak?

**Yang dibutuhkan:** saldo wallet sekarang $0.00; perlu deposit USDT kecil di
X Layer untuk mendanai escrow (task A2A di marketplace berkisar $0.1–$3.0, jadi
beberapa dolar sudah lebih dari cukup).

**Risiko:** platform mungkin menolak akun yang sama jadi pembeli sekaligus
penjual pada satu task. Kalau tertolak, jalan mundurnya adalah akun kedua
(email kedua) sebagai pembeli.
**Format telemetry — bukan pertanyaan verifikasi, ini keputusan desain. Sudah
diputuskan:** jangan minta format khusus. Terima apa yang ASP sudah punya —
setiap API LLM sudah mengembalikan blok `usage`. Jadi kontraknya cukup:

```json
{"ts":"<iso8601>","service":"<id>","model":"<name>",
 "input_tokens":N,"output_tokens":N,"cached_tokens":N,
 "outcome":"ok|error|timeout","latency_ms":N}
```

Integrasinya jadi satu kalimat: *"teruskan objek `usage` yang sudah kamu terima."*
Untuk yang menolak instrumentasi sama sekali, ada mode estimasi dari ukuran
response + latency + model yang dideklarasikan di listing — kurang presisi, tapi
cukup menjawab "rugi atau tidak".
- Klarifikasi tanggal submission: halaman HackQuest menyebut 27 Juli 22:59 UTC,
  FAQ di halaman yang sama menyebut window 2–17 Juli
