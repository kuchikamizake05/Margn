# Margn — Pemeriksaan pra-pembelian untuk OKX.AI

> **Di detik uang bergerak, pembeli melihat Provider, Service, Price. Tidak ada
> liveness. Tidak ada skor keamanan. Tidak ada rentang harga pasar.
> Margn mengisi kartu itu.**

**Status dokumen.** Menggantikan `MARGN.md` (v1, CFO agent), `MARGN-v2.md`
(v2, margin engine), dan `MARGN-ROUTER.md` (v3, routing layer). Ketiganya
disimpan sebagai arsip — jangan dipakai untuk submission.

Setiap angka di sini diukur ulang pada **22 Juli 2026** di mesin ini, bukan
disalin dari dokumen sebelumnya. Angka di ketiga dokumen lama sebagian besar
**tidak akurat** — lihat §7.

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
| 5 | #2013 | $0.01 | 100.0 | 5.00 | **1560** |
| 6 | #5209 | $0.05 | — | — | 2 |
| **7** | **#2118** | **$0.001** | **100.0** | **4.75** | **221** |

Pilihan terbaik pada **setiap** metrik — termurah, reputasi sempurna, keamanan
4.75, 221 penjualan terbukti — berada di **peringkat 7**. Di atasnya, pada
peringkat 3, duduk layanan yang **550× lebih mahal** dengan rating umpan balik
0.0 dan skor keamanan 2.0. Penjual paling terbukti di daftar itu (1.560
penjualan) ada di peringkat 5, juga di bawahnya.

### Dan ini sistematis, bukan satu kasus sial

Diuji pada delapan kebutuhan berbeda. Pada **8 dari 8**, opsi terbaik-menurut-nilai
diperingkat di bawah opsi yang lebih mahal *dan* lebih buruk:

| Kebutuhan | Peringkat opsi terbaik | Yang diperingkat di atasnya |
| --- | --- | --- |
| crypto news | 7 | 550× lebih mahal, `securityRate` 2.0 |
| analyze portfolio | 5 | 800× lebih mahal, tanpa skor |
| swap on dex | 7 | 200× lebih mahal, tanpa skor |
| translate text | 5 | 20× lebih mahal, tanpa skor |
| token price data | 6 | 5× lebih mahal, tanpa skor |
| generate image | 8 | 3× lebih mahal |
| wallet balance | 10 | $0.8 vs $0, tanpa skor |
| smart contract audit | 10 | $1.0 vs $0, tanpa skor |

Retrieval-nya bagus. **Ranking-nya tidak ada.**

Juri bisa memverifikasi seluruh tabel ini dengan satu perintah CLI di mesin
mereka sendiri. Pembandingnya adalah API OKX sendiri.

---

## 2. Kondisi pasar, terukur

Union 44 query `onchainos agent search`. Query luas (`"a"`, `"the"`) sama-sama
mengembalikan 951, jadi ini praktis sensus, bukan sampel.

| Metrik | Nilai |
| --- | --- |
| Agent unik | **985** |
| Layanan | **2.344** (A2MCP 1.578 · A2A 766) |
| Endpoint unik | 1.486 |
| Total penjualan | 25.932 |
| Sedang offline | **221 (22,4%)** |
| **Nol penjualan** | **547 (55,5%)** |
| Penjual teratas (PixelBrief) | 10.112 = **39,0%** seluruh transaksi |

**Kategori tidak membantu memilih apa pun:**
Software services 657 (66,7%) · Finance 152 (15,4%) · Lifestyle 100 (10,2%) ·
Art creation 64 (6,5%) · lainnya 13.

**Harga membentang sembilan orde besaran.** 2.180 layanan berharga, 159 gratis.
Terendah $0.000001, tertinggi $5.000. Harga tersering: $0.01 (300 layanan),
$0.1 (283), $1.0 (274).

### Temuan yang membatasi desain

```
feedbackRate : ada pada 243/985  (25%)  — null 742
securityRate : ada pada 244/985  (25%)  — null 741
```

**75% agent tidak punya skor reputasi maupun keamanan.** Dari 244 yang punya
`securityRate`, 166 bernilai 5.0 — jadi yang benar-benar membedakan hanya 78
agent (8% pasar).

Konsekuensinya tegas: **reputasi tidak bisa jadi tulang punggung peringkat.**
Yang tersedia untuk seluruh pasar hanya **harga** dan **liveness**. Itulah yang
Margn ukur.

### Liveness terukur langsung

Probe 300 dari 1.486 endpoint (sampel acak, seed tetap):

| Hasil | Jumlah | % |
| --- | --- | --- |
| `402` — sehat, siap dibayar | 201 | 67,0% |
| `404` / `405` / `403` / `400` / `406` | 69 | 23,0% |
| `200` — tidak menagih | 19 | 6,3% |
| tidak terjangkau (timeout / DNS) | 8 | 2,7% |

Sebagian `405` kemungkinan endpoint POST-only yang kuprobe dengan GET —
dokumen OKX sendiri memperingatkan ini. **Jadi 67% adalah batas bawah**, dan
angka ini harus disajikan sebagai batas bawah, bukan sebagai vonis.

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
| `quote(need)` | Rentang harga pasar untuk kebutuhan itu: min · median · maks | 2.180 harga publik |
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
| 35–55 dtk | Margn berdampingan: peringkat 7 = $0.001, reputasi 100, keamanan 4.75, 221 penjualan. *"Sinyalnya sudah ada di API OKX. Tidak ada yang membacanya."* |
| 55–75 dtk | Tabel 8-dari-8: kesenjangan ini sistematis. Lalu efek ekor panjang — **55,5% agent tidak pernah menjual apa pun**. |
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
- Fee sebagai string angka polos (`"0.01"`), USDT implisit, ≤6 desimal
- Lolos `validate-listing`

**Sudah siap di mesin ini:** `onchainos` v4.3.0 · login Apple
`0xd4cc…4078` · agent User **#7520 "Margn Recon"** (peran User; identitas ASP
akan jadi agent terpisah, karena role tidak bisa diubah setelah create).

---

## 7. Koreksi terhadap dokumen lama

Angka di `MARGN-v2.md` dan `MARGN-ROUTER.md` diukur 21 Juli di mesin lain.
Diukur ulang 22 Juli:

| Klaim lama | Terukur | |
| --- | --- | --- |
| 140 agent | **985** | 7× lebih besar |
| 477 layanan | **2.344** | 5× lebih besar |
| 34% offline | **22,4%** | dilebihkan |
| 39% nol penjualan | **55,5%** | diremehkan |
| 47% konsentrasi | **39,0%** | dilebihkan |
| endpoint sehat 81% | **67%** | dilebihkan |
| `securityRate` = sinyal paling diskriminatif | null pada 75% agent | **klaim dicoret** |

Yang **bertahan utuh**: kesenjangan ranking `asp-match`, direproduksi persis
satu hari kemudian, dan kini terbukti sistematis lintas 8 kebutuhan.

Tiga angka yang jadi tulang punggung demo lama — 47%, 39%, 34% — semuanya
salah. Kalau juri mengecek sendiri, dan mereka bisa dengan satu perintah,
kredibilitas habis di detik itu. **Jangan pakai angka lama di mana pun.**

---

## 8. Risiko — jujur

**OKX bisa membangun ini sendiri, dalam seminggu.** Tidak ada moat; ini
pengurutan berdasarkan field yang sudah ada di API mereka. Mitigasi: hadiahnya
mencakup partnership, jadi "diserap OKX" bukan kekalahan — membuktikan
kebutuhannya lebih dulu adalah posisi yang baik.

**Reputasi tipis.** 75% pasar tanpa skor. Produk hanya boleh menjanjikan apa
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

1. Bangun endpoint minimal: `verify` · `quote` · `check`, x402 (`402` lalu JSON).
2. Deploy ke HTTPS publik yang stabil dan permanen.
3. Siapkan avatar 1:1 dan teks listing sesuai checklist §6.
4. Daftarkan identitas ASP sekali, dengan URL final.
5. Rekam demo §5, posting di X dengan `#OKXAI`.
6. Submit Google Form sebelum 27 Juli 23:59 UTC.

> **Catatan metodologi.** Agent, layanan, harga, kategori, skor, dan hasil
> `asp-match` adalah pengukuran penuh (22 Juli 2026, union 44 query). Kesehatan
> endpoint adalah sampel 300 dari 1.486 dan disajikan sebagai batas bawah.
> Skrip scan dan probe ada di scratchpad sesi, bisa dijalankan ulang kapan pun.
