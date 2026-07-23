# Margn — Pemeriksaan pra-pembelian untuk OKX.AI

> **Di detik uang bergerak, pembeli melihat Provider, Service, Price. Tidak ada
> liveness. Tidak ada skor keamanan. Tidak ada rentang harga pasar.
> Margn mengisi kartu itu.**

**Status dokumen.** Menggantikan `MARGN.md` (v1, CFO agent), `MARGN-v2.md`
(v2, margin engine), dan `MARGN-ROUTER.md` (v3, routing layer). Ketiganya
disimpan sebagai arsip — jangan dipakai untuk submission.

Setiap angka di sini berasal dari satu pengukuran tunggal di mesin ini —
**23 Juli 2026, 19:55 WIB** — bukan disalin dari dokumen sebelumnya. Angka di
ketiga dokumen lama sebagian besar **tidak akurat** — lihat §7.

Skrip dan data mentahnya ada di `research/marketplace-scan/`, dan bisa
dijalankan ulang kapan saja: `scan.py` → `stats.py` · `probe.py` ·
`matchtest.py`. Setiap run menulis file bertanda waktu sampai menit
(`agents-2026-07-23T1955.json`) dan menolak menimpa run sebelumnya, sehingga
angka yang sudah dikutip di dokumen ini selalu bisa ditelusuri ke file
sumbernya.

---

## 1. Apa yang benar-benar rusak

`asp-match` adalah matcher first-party OKX. Ia menemukan layanan yang relevan
dengan baik. Ia **tidak memeringkat berdasarkan nilai sama sekali.**

Permintaan `"get latest crypto news headlines"`, dijalankan dari agent #7520:

| # | Agent | Harga | feedbackRate | securityRate | Terjual |
| --- | --- | --- | --- | --- | --- |
| 1 | #4464 | $0.01 | — | — | 5 |
| 2 | #5325 | $0.10 | — | — | — |
| **3** | **#3152** | **$0.55** | **0.0** | **2.00** | **1** |
| 4 | #5077 | $0.05 | — | — | 3 |
| **5** | **#2013** | **$0.01** | **100.0** | **5.00** | **1.670** |
| 6 | #6923 | $0.005 | — | — | 14 |
| 7 | #5209 | $0.05 | — | — | 2 |
| 8 | #4462 | $0.01 | — | — | 6 |
| 9 | #5634 | $0.06 | 100.0 | 5.00 | 1 |
| 10 | #3577 | $0.05 | 100.0 | 5.00 | 4 |

Bandingkan peringkat 3 dan 5. **#2013 lebih baik pada setiap metrik yang
diukur platform sendiri** — 55× lebih murah, reputasi 100.0 lawan 0.0, keamanan
5.00 lawan 2.00, dan **1.670 penjualan lawan 1**. Ia tetap diperingkat di
bawahnya.

Ini bukan soal "yang murah kalah". Penjual paling terbukti di seluruh daftar
kalah dari penjual dengan satu penjualan dan rating umpan balik nol.

### Dan ini sistematis, bukan satu kasus sial

Diuji pada delapan kebutuhan berbeda. Pada **7 dari 7 yang berhasil dijalankan**,
opsi terbaik-menurut-nilai diperingkat di bawah opsi yang lebih mahal *dan*
lebih buruk:

| Kebutuhan | Peringkat opsi terbaik | Yang diperingkat di atasnya |
| --- | --- | --- |
| analyze portfolio | 5 | **800×** lebih mahal, tanpa skor |
| crypto news | 5 | 55× lebih mahal, `securityRate` 2.0, 1 penjualan |
| swap on dex | 5 | 40× lebih mahal, tanpa skor |
| translate text | 7 | 20× lebih mahal, tanpa skor |
| generate image | 9 | 3× lebih mahal |
| wallet balance | 10 | $0.8 lawan $0, tanpa skor |
| smart contract audit | 10 | $1.0 lawan $0, tanpa skor |

Kebutuhan kedelapan (`"get token price and market data"`) tidak bisa diuji:
`asp-match` mengembalikan `code=4001: SearchApi.taskSearchAgentPost failed`.
Ini **deterministik, bukan transien** — frasa `"token price data"` selalu gagal
sementara `"token price"` berhasil. Bug kecil milik platform; jangan dipakai
sebagai bahan serangan, tapi tahu bahwa ia ada.

Retrieval-nya bagus. **Ranking-nya tidak ada.**

Juri bisa memverifikasi seluruh tabel ini dengan satu perintah CLI di mesin
mereka sendiri. Pembandingnya adalah API OKX sendiri.

### ⚠️ Peringkat bergeser harian — jangan mengunci satu angka

Diukur 22 Juli, peringkat 1–5 untuk `crypto news` identik dengan hari ini, tapi
#2118 ($0.001 · keamanan 4.75 · 221 penjualan) **jatuh keluar dari 10 besar**
dalam 24 jam. Angka unggulan kemarin — 550× — hari ini menjadi 55×.

**Konsekuensi praktis:** jangan menaruh satu angka rasio di judul demo atau
post X. Yang stabil adalah **mekanismenya** (peringkat 3 = $0.55, keamanan 2.0,
1 penjualan — bertahan persis lintas dua hari), bukan besaran rasionya.
Jalankan ulang `matchtest.py` di hari perekaman demo, dan kutip angka hari itu.

---

## 2. Kondisi pasar, terukur

Union **45 query** `onchainos agent search` (daftar query dibekukan di `scan.py`
dan ikut tersimpan di tiap file keluaran, agar dua pengukuran bisa
dibandingkan). Query luas (`"a"`, `"the"`) sama-sama mengembalikan ~seluruh
pasar, jadi ini praktis sensus, bukan sampel.

| Metrik | 23 Juli | 22 Juli | Δ |
| --- | --- | --- | --- |
| Agent unik | **1.006** | 985 | +21 |
| Layanan | **2.439** (A2MCP 1.673 · A2A 766) | 2.344 | +95 |
| Endpoint unik | **1.585** | 1.486 | +99 |
| Total penjualan | **27.971** | 25.932 | **+2.039 dalam sehari** |
| Sedang offline | **218 (21,7%)** | 22,4% | −0,7 pp |
| **Nol penjualan** | **554 (55,1%)** | 55,5% | −0,4 pp |
| Penjual teratas (PixelBrief) | 10.217 = **36,5%** | 39,0% | −2,5 pp |

Pasar tumbuh ~2.000 transaksi per hari menjelang tenggat, tapi **proporsi yang
tidak pernah menjual apa pun praktis tidak bergerak** — 55%. Pertumbuhan
mengalir ke agent yang sudah menang.

**Kategori tidak membantu memilih apa pun:**
Software services 669 (66,5%) · Finance 156 (15,5%) · Lifestyle 102 (10,1%) ·
Art creation 67 (6,7%) · lainnya 13.

**Harga membentang sembilan orde besaran.** 2.273 layanan berharga, 169 gratis.
Terendah $0.000001, tertinggi $5.000. Harga tersering: $0.01 (320 layanan),
$0.1 (289), $1.0 (278).

### Temuan yang membatasi desain

```
feedbackRate : ada pada 257/1006  (26%)  — null 749
securityRate : ada pada 258/1006  (26%)  — null 748
```

**74% agent tidak punya skor reputasi maupun keamanan.** Dari 258 yang punya
`securityRate`, 175 bernilai 5.0 — jadi yang benar-benar membedakan hanya 83
agent (8% pasar). Rasio ini stabil lintas semua pengukuran.

Konsekuensinya tegas: **reputasi tidak bisa jadi tulang punggung peringkat.**
Yang tersedia untuk seluruh pasar hanya **harga** dan **liveness**. Itulah yang
Margn ukur.

### Liveness terukur langsung

Probe 300 dari 1.585 endpoint (sampel acak, seed tetap = 7):

| Hasil | Jumlah | % |
| --- | --- | --- |
| `402` — sehat, siap dibayar | 206 | **68,7%** |
| `404` / `405` / `403` / `406` / `400` / `422` | 64 | 21,3% |
| `200` — tidak menagih | 20 | 6,7% |
| tidak terjangkau (timeout / DNS) | 10 | **3,3%** |

Sebagian `405` kemungkinan endpoint POST-only yang kuprobe dengan GET —
dokumen OKX sendiri memperingatkan ini. **Jadi ~69% adalah batas bawah**, dan
angka ini harus disajikan sebagai batas bawah, bukan sebagai vonis.

**Angka probe bervariasi ±3 pp antar-run** pada seed dan sampel yang sama
(terukur 67,0% · 65,3% · 68,7% dalam dua hari) — itu variansi jaringan, bukan
perubahan pasar. Kutip sebagai kisaran "sekitar dua pertiga", jangan sebagai
angka presisi.

**`onlineStatus` tidak dapat dipercaya sebagai sinyal liveness.** Dari 297
endpoint yang platform tandai `onlineStatus=1` (online), hanya **68% yang
benar-benar mengembalikan `402`** dan 3% tidak menjawab sama sekali. Inilah
justifikasi paling langsung untuk `verify()`: satu-satunya cara tahu sebuah ASP
hidup adalah memanggilnya sekarang, bukan membaca flag-nya.

---

## 3. Batas keras: tidak ada pembeli otonom

Diverifikasi terhadap repo resmi `okx/onchainos-skills`.

- `okx-agent-payments-protocol/SKILL.md` —
  *"You MUST stop and confirm before paying — do not auto-pay."*
  Gerbang konfirmasi wajib lewat `AskUserQuestion`; `payment pay` menuntut
  `--yes`, yang mereka sebut *"the fund-moving confirming gate"*.
- `okx-ai/references/watch-core.md` — balasan pengguna
  *"is not a license to autonomously pick a provider, start a negotiation,
  solicit quotes..."*
- `task-user-actions-publish.md` — *"Display the service list to the user and
  ask them to pick one"*, *"Loop until a match is found or the user gives up"*.

Yang otonom hanyalah tahap **setelah** pilihan dijatuhkan: negosiasi (maks 2
ronde), delivery, sub-session.

**Pembagiannya: manusia memilih dan membayar, agent mengeksekusi.**

### Dua hal yang mati karena ini

1. **Router runtime.** Konsep "dipanggil sebelum setiap pembelian" pada
   frekuensi mesin tidak punya pemanggil. Model $0.001 × volume besar tidak ada
   dasarnya.
2. **Pay-per-call untuk Margn sendiri.** Kalau Margn dijual sebagai A2MCP,
   setiap panggilan ke Margn memicu prompt konfirmasi pembayaran ke manusia.
   Meminta orang menyetujui satu dialog pembayaran demi saran tentang pembelian
   yang sedang mereka setujui di dialog sebelahnya — friksinya melebihi
   nilainya.

Ini bukan alasan menyerah. Ini alasan mengubah bentuk.

---

## 4. Bentuk yang bertahan

Bukan router. **Pemeriksaan pra-pembelian untuk manusia**, dipanggil sekali per
keputusan beli — bukan sekali per panggilan API.

Kartu konfirmasi yang dilihat pembeli sebelum dana bergerak isinya persis ini:

| Field | Value |
| --- | --- |
| Provider | Agent 864 |
| Service Price | 0.08 USDT |

Tidak ada liveness. Tidak ada skor. Tidak ada konteks harga. Margn mengisinya.

### Permukaan produk

| Tool | Fungsi | Sumber data |
| --- | --- | --- |
| `verify(agentId)` | Hidup atau mati **sekarang** — probe langsung, tidak pernah dari cache | probe HTTP |
| `quote(need)` | Rentang harga pasar untuk kebutuhan itu: min · median · maks | 2.273 harga publik |
| `check(agentId, price)` | Gabungan keduanya + posisi harga terhadap pasar | keduanya |

`verify()` adalah tool terpenting, bukan `route()`. "Endpoint ini mati" bersifat
biner dan tidak bisa dibantah. "Ini terlalu mahal" selalu bisa didebat.

### Prinsip yang tidak boleh dilanggar

- **Jangan pernah mengklaim "terbaik".** Klaim "transparan". Tampilkan rentang,
  tandai outlier, sebutkan alasannya, biarkan manusia yang memutuskan.
- **Jangan pernah memakai penilaian kualitas subjektif.** Hanya fakta terukur:
  harga, liveness, skor milik platform sendiri.
- **Liveness tidak boleh di-cache.** Harga boleh.
- **Jangan pernah memosisikan Margn sebagai pengganti `asp-match`.** Selalu
  sebagai lapisan di atasnya.

---

## 5. Demo 90 detik

Semua data nyata, semua bisa diverifikasi ulang oleh juri.

| Waktu | Isi |
| --- | --- |
| 0–10 dtk | `verify()` menangkap ASP yang mati. *"Kamu akan membayar layanan yang tidak jalan. Tidak ada yang memberitahumu."* Biner, tidak bisa dibantah. |
| 10–35 dtk | Jalankan `asp-match` bawaan OKX, layar penuh, tidak dipotong. Zoom ke peringkat 3: **$0.55 · feedback 0.0 · security 2.0**. *"Ini API OKX sendiri. Jalankan perintah yang sama sekarang juga."* |
| 35–55 dtk | Margn berdampingan: peringkat 5 = $0.01, reputasi 100, keamanan 5.00, **1.670 penjualan** — lebih baik di setiap metrik, tetap di bawah. *"Sinyalnya sudah ada di API OKX. Tidak ada yang membacanya."* |
| 55–75 dtk | Tabel 7-dari-7: kesenjangan ini sistematis. Lalu efek ekor panjang — **55% agent tidak pernah menjual apa pun**. |
| 75–90 dtk | Tiga tool, satu kalimat masing-masing. Selesai. |

**Yang harus dihindari:** jangan pakai slide (terminal asli saja); jangan
sebut nama ASP yang kamu tampilkan sebagai contoh buruk — pakai ID, mereka
peserta lain; jangan sembunyikan latensi probe; jangan bilang "kami memperbaiki
OKX" — bilang "kami membaca sinyal yang sudah ada di sana".

---

## 6. Registrasi dan tenggat

Submission ditutup **27 Juli 2026, 23:59 UTC**, dan ASP harus **sudah live**,
bukan sekadar disubmit. Antrean review OKX di luar kendali kita — ini risiko
terbesar, dan tidak ada hubungannya dengan kualitas ide.

**A2MCP menuntut endpoint yang sudah ter-deploy.** Dari `identity-register.md` §6:
*"Require `https://`, publicly reachable, and really deployed"* — `localhost`,
IP privat, URL mock, dan placeholder ditolak. Endpoint bersifat **permanen
on-chain**; menggantinya butuh transaksi update.

Karena itu urutannya: **endpoint dulu, lalu daftar sekali dengan URL final.**
Jangan tergoda mendaftar A2A hanya demi masuk antrean — A2A menjadikan tiap
pembelian sebuah task escrow bernegosiasi, bentuk yang salah untuk pemeriksaan
cepat, dan tipe layanan tidak bisa diubah setelah dibuat.

**Checklist registrasi** (semuanya wajib, `severity: block`):

- Nama 3–25 karakter, tanpa penanda "test", tanpa nama tokoh publik
- Deskripsi ≤500 karakter
- **Avatar file gambar 1:1** — link gambar ditolak, tidak ada default untuk ASP
- Deskripsi layanan **dua bagian di baris terpisah**: ① fungsi + untuk siapa,
  ② apa yang harus disediakan pemanggil. Masing-masing ≤200 karakter. Dilarang:
  contoh prompt, link GitHub, detail tech-stack, disclaimer
- Fee sebagai string angka polos, USDT implisit, ≤6 desimal — wajib ada untuk
  A2MCP, tapi **`"0"` sah dan lolos review** (terverifikasi di pasar: agent
  #6711 dan #2162 menjual A2MCP dengan `fee: "0"`)

> Catatan: `validate-listing` **tidak ada** di CLI v4.3.0. Empat aturan pertama
> di atas juga tidak divalidasi runtime — asalnya dari `okx/onchainos-skills`.
> Tetap patuhi, tapi jangan berharap pesan error yang sama persis.

### Yang terverifikasi langsung di CLI (23 Juli)

- **A2MCP bukan server MCP.** Endpoint yang terdaftar berbentuk REST biasa —
  `/audit`, `/analyze`, `/v1/quote`. Cukup HTTPS yang menerima POST dan
  membalas JSON; tidak ada JSON-RPC, tidak ada handshake.
- **Dua gerbang, bukan satu.** QA konten jalan seketika di `agent create`;
  antrean review sesungguhnya ada di `agent activate`. Salah format ketahuan
  detik itu juga, bukan setelah menunggu berhari-hari.
- **`agent update` memicu QA ulang.** Setelah approved, jangan sentuh. Mengubah
  kode di balik URL tidak menyentuh registry sama sekali — yang berbahaya hanya
  mengubah string endpoint-nya.
- **Boleh lebih dari satu ASP per wallet** (`pre-check` → `uniqueness:
  "multiple"`), jadi percobaan pertama yang gagal bukan akhir.
- **Avatar harus diunggah lewat `agent upload --file`**, lalu URL CDN hasilnya
  dipakai di `--picture`. Link gambar eksternal ditolak.

**Sudah siap di mesin ini:** `onchainos` v4.3.0 · login Apple
`0xd4cc…4078` · agent User **#7520 "Margn Recon"** (peran User; identitas ASP
akan jadi agent terpisah, karena role tidak bisa diubah setelah create).
`pre-check --role asp` → `canCreate: true`, `aspCount: 0`.

---

## 7. Koreksi terhadap dokumen lama

Angka di `MARGN-v2.md` dan `MARGN-ROUTER.md` diukur 21 Juli di mesin lain.
Diukur ulang 22 dan 23 Juli:

| Klaim lama | Terukur (23 Jul) | |
| --- | --- | --- |
| 140 agent | **1.006** | 7× lebih besar |
| 477 layanan | **2.439** | 5× lebih besar |
| 34% offline | **21,7%** | dilebihkan |
| 39% nol penjualan | **55,1%** | diremehkan |
| 47% konsentrasi | **36,5%** | dilebihkan |
| endpoint sehat 81% | **~69%** | dilebihkan |
| `securityRate` = sinyal paling diskriminatif | null pada 74% agent | **klaim dicoret** |

Yang **bertahan utuh**: kesenjangan ranking `asp-match`, direproduksi dua hari
berturut-turut, terbukti sistematis lintas semua kebutuhan yang bisa diuji.
Peringkat 3 untuk `crypto news` — #3152, $0.55, keamanan 2.0, 1 penjualan —
tidak bergeser sedikit pun dalam 24 jam.

Tiga angka yang jadi tulang punggung demo lama — 47%, 39%, 34% — semuanya
salah. Kalau juri mengecek sendiri, dan mereka bisa dengan satu perintah,
kredibilitas habis di detik itu. **Jangan pakai angka lama di mana pun.**

**Aturan yang berlaku ke depan:** jalankan ulang `scan.py` + `matchtest.py`
pada hari perekaman demo dan hari submission. Pasar bergerak ~2.000 transaksi
per hari; angka berumur tiga hari sudah bisa meleset.

---

## 8. Risiko — jujur

**OKX bisa membangun ini sendiri, dalam seminggu.** Tidak ada moat; ini
pengurutan berdasarkan field yang sudah ada di API mereka. Mitigasi: hadiahnya
mencakup partnership, jadi "diserap OKX" bukan kekalahan — membuktikan
kebutuhannya lebih dulu adalah posisi yang baik.

**Reputasi tipis.** 74% pasar tanpa skor. Produk hanya boleh menjanjikan apa
yang bisa diukur untuk seluruh pasar: harga dan liveness.

**Menghakimi peserta lain itu sensitif.** Margn memeringkat ASP milik peserta
hackathon lain. Jaga peringkat tetap transparan dan berbasis fakta terukur.

**Tenggat, dan ketergantungan pada review.** Lihat §6. Ini penentu terbesar,
dan bukan soal ide.

**Kualitas output tidak terukur.** Margn mengukur harga, liveness, reputasi —
bukan mutu hasil. $0.001 dan $0.55 belum tentu barang yang sama. Karena itu
produk ini menyajikan konteks, bukan vonis "terbaik".

---

## 9. Fit ke track

| Track | Prize | Fit |
| --- | --- | --- |
| **Software Utility** | 2.500 USDT each | **Target utama** — infrastruktur murni, pesaing paling tipis |
| **Best Product** | $20k (1st $10k) | Upside kalau eksekusinya rapi |
| ~~Revenue Rocket~~ | — | **Coret.** Mati secara struktural (§3), bukan hanya karena waktu |

---

## 10. Langkah berikutnya

1. Bangun endpoint minimal: `verify` · `quote` · `check` — POST masuk, JSON
   keluar. **Tanpa x402:** ketiganya didaftarkan `fee: "0"`, jadi tidak ada
   gerbang konfirmasi pembayaran yang menghalangi agent memanggil Margn (§3),
   dan tidak ada alur pembayaran yang perlu diimplementasikan sama sekali.
2. Deploy ke HTTPS publik yang stabil dan permanen. Pakai domain sendiri —
   URL bersifat permanen on-chain, jadi pindah hosting nanti cukup ubah DNS
   ketimbang `agent update` yang memicu QA ulang.
3. Siapkan avatar 1:1 dan teks listing sesuai checklist §6.
4. Daftarkan identitas ASP sekali, dengan URL final.
5. Rekam demo §5, posting di X dengan `#OKXAI`.
6. Submit Google Form sebelum 27 Juli 23:59 UTC.

> **Catatan metodologi.** Agent, layanan, harga, kategori, skor, dan hasil
> `asp-match` adalah pengukuran penuh (23 Juli 2026, union 45 query). Kesehatan
> endpoint adalah sampel 300 dari 1.585 dan disajikan sebagai batas bawah.
> Skrip, data mentah, dan keluaran tiap run ada di `research/marketplace-scan/`
> (`agents-<tanggal>T<jam>.json`, `stats-*.txt`, `probe-*.txt`,
> `matchtest-*.txt`) — bisa dijalankan ulang dan dibandingkan antar run kapan
> pun. Nama file memuat jam dan `scan.py` menolak menimpa run yang sudah ada,
> jadi setiap angka di dokumen ini tetap punya file sumber yang utuh.
