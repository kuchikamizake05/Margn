# Ide 3: Margn — The Routing Layer for the OKX.AI Agent Economy

> **Setiap agent pembeli di OKX.AI memilih penyedia secara buta.
> Margn memberi tahu mana yang hidup, mana yang murah, dan mana yang layak dipercaya —
> sebelum uangnya keluar.**

Nama tetap **Margn**. Artinya tidak berubah: melindungi margin. Sebelumnya dengan
menghitung biaya sendiri; sekarang dengan mencegah pembeli membayar 500× lipat.

---

## 1. Masalahnya

Ketika sebuah agent butuh "berita kripto terbaru", ia harus memilih di antara
sekian ASP. Tidak ada cara memilih selain menebak — dan harga untuk kebutuhan
yang sama berbeda sampai ribuan kali lipat.

Ini bukan dugaan. Semua angka di bawah diukur langsung pada **21 Juli 2026**
lewat `onchainos agent search` (140 agent unik, 477 layanan) dan probe endpoint.

### Kompetisi nyata per kebutuhan

| Kebutuhan | ASP bersaing | Rentang harga | Selisih |
| --- | --- | --- | --- |
| search | 27 | $0 – $10 | gratis vs berbayar |
| token | 25 | $0 – $5 | gratis vs berbayar |
| wallet | 21 | $0 – $5.99 | gratis vs berbayar |
| audit | 10 | $0 – $25 | gratis vs berbayar |
| **news** | **8** | **$0.001 – $0.5** | **500×** |
| swap | 3 | $0.000001 – $0.05 | **50.000×** |
| kline | 2 | $0.000001 – $0.01 | **10.000×** |
| image | 3 | $0.15 – $9.99 | 67× |

Kategori resmi tidak menolong sama sekali: **79 dari 140 agent** semuanya
berada di satu kategori `Software services`.

### Dan matching bawaan platform tidak memeringkat berdasarkan nilai

Uji langsung terhadap `onchainos agent asp-match`, matcher first-party OKX,
dengan permintaan `"get latest crypto news headlines"`. Tiga hasil teratas:

| Urutan | Agent | Harga | feedbackRate | securityRate |
| --- | --- | --- | --- | --- |
| 1 | #4464 | $0.01 | null | null |
| 2 | #5325 | $0.10 | null | null |
| 3 | #3152 (Messari) | **$0.55** | **0.0** | **2.0** |

Peringkatnya **murni semantik**. Ia menempatkan layanan $0.55 dengan rating
umpan balik 0.0 dan skor keamanan 2.0 di tiga besar — 55× lebih mahal daripada
pilihan teratas, dengan reputasi terburuk di antara hasilnya sendiri.

Retrieval-nya bagus. **Ranking-nya tidak ada.**

---

## 2. Apa yang Margn lakukan

Margn **bukan pesaing** `asp-match`. Ia lapisan peringkat di atas retrieval yang
sudah ada — mengambil kandidat yang relevan, lalu menjawab pertanyaan yang belum
dijawab siapa pun: *dari semua ini, mana yang sebenarnya harus kupilih?*

```
   Butuh "crypto news"
          ↓
   [ retrieval: kandidat yang relevan secara semantik ]
          ↓
   [ MARGN: harga · liveness · reputasi · rekam jejak ]
          ↓
   satu pilihan + alasannya + alternatifnya
```

### Sinyal peringkat (semuanya publik, tanpa izin siapa pun)

| Sinyal | Sumber | Kenapa penting |
| --- | --- | --- |
| Harga per call | `feeAmount` tiap layanan | selisih sampai 500× untuk kebutuhan sama |
| **Liveness** | `onlineStatus` + probe endpoint | 34% agent sedang offline |
| Kesehatan endpoint | probe HTTP | 81% sehat (`402`), 5% rusak |
| Reputasi | `feedbackRate` | 14 dari 140 di bawah 100 |
| Keamanan | `securityRate` | **21 dari 140 di bawah 5.0, rentang 1.0–4.89** |
| Rekam jejak | `soldCount` | membedakan yang terbukti dari yang belum |

`securityRate` adalah sinyal paling diskriminatif di platform ini sekarang, dan
`asp-match` mengabaikannya sepenuhnya.

### Permukaan produk (A2MCP, pay-per-call)

| Tool | Fungsi |
| --- | --- |
| `route(need)` | satu ASP terbaik + alasan + alternatif, sudah tersaring liveness |
| `quote(need)` | rentang harga pasar untuk kebutuhan itu — "wajarnya berapa" |
| `verify(agentId)` | apakah ASP ini hidup dan sehat **sekarang** |
| `compare(agentIds[])` | adu langsung harga, liveness, reputasi |

Mode A2A menyediakan laporan procurement untuk pembelian besar atau berulang.

---

## 3. Kenapa ini menang, sementara analitik-untuk-ASP tidak

**Pasarnya setiap agent pembeli, bukan sepuluh developer.** Versi Margn
sebelumnya menjual ke ASP — padahal 39% ASP nol penjualan dan 34% offline, jadi
pasar berbayarnya mendekati nol. Router dipakai oleh sisi pembeli, yang jumlahnya
tidak dibatasi jumlah ASP.

**Frekuensinya tinggi.** Dipanggil sebelum setiap pembelian. Lihat siapa yang
menang di pasar ini: PixelBrief 10.098 penjualan, 记忆映画 1.353, CoinAnk 1.532 —
semuanya layanan murah berfrekuensi tinggi. Volume adalah satu-satunya hal yang
bisa dilihat dan dirayakan tim platform.

**Ia memperbaiki masalah struktural OKX, bukan mempermalukannya.** 47% transaksi
dikuasai satu agent dan 39% agent tidak pernah menjual apa pun. Itu kegagalan
matching. Router yang memeringkat berdasarkan nilai **memunculkan ekor panjang** —
lebih banyak ASP dapat penjualan, pasar jadi lebih sehat. Kepentingannya sejajar
dengan kepentingan OKX.

**Nadanya konstruktif.** Konsep sebelumnya berpuncak pada "beginilah tidak
sehatnya pasar kalian" — dipublikasikan di X dengan #OKXAI, di depan juri yang
baru meluncurkan platform ini tiga minggu lalu. Router menyampaikan temuan yang
sama sebagai perbaikan, bukan tuduhan.

---

## 4. Demo (90 detik, semua data nyata)

1. Agent butuh berita kripto. Jalankan `asp-match` bawaan platform — hasil ketiga
   $0.55 dengan rating keamanan 2.0.
2. Jalankan `Margn.route("crypto news")` — $0.001, hidup, reputasi bersih.
3. **Selisih 500×, di layar, sisi-sisian.**
4. Tunjukkan `verify()` menangkap ASP yang offline sebelum uang keluar.
5. Tutup dengan efek ekor panjang: rekomendasi Margn menyebar ke ASP yang selama
   ini tidak pernah terpilih.

Juri bisa memverifikasi baseline-nya dengan perintah CLI mereka sendiri —
pembandingnya adalah API OKX sendiri, bukan angka karangan kami.

---

## 5. Model bisnis

Tagih kecil per panggilan routing (~$0.001). Mudah dibenarkan ketika sekali
routing menghemat 500×. Frekuensi tinggi × margin tipis = volume nyata, pola yang
sama dengan pemenang-pemenang di pasar ini.

---

## 6. Fit ke track

| Track | Prize | Fit |
| --- | --- | --- |
| **Software Utility** | 3 × $2.500 | Paling realistis — infrastruktur murni, pesaing paling sedikit |
| **Best Product** | $20k (1st $10k) | Kuat kalau eksekusinya rapi; ini produk infrastruktur sejati |
| **Revenue Rocket** | $20k (1st $10k) | Jalur tidak langsung: menaikkan pendapatan ekor panjang ASP |

Bidik **Software Utility** sebagai target utama (3 pemenang, persaingan paling
tipis), dengan **Best Product** sebagai upside.

---

## 7. Risiko — jujur

**OKX bisa membangun ini sendiri.** Ini risiko nyata dan tidak bisa dihilangkan.
Mitigasi: itu justru argumen bahwa ini layak dibangun — kalau platform akhirnya
membutuhkannya, membuktikan kebutuhannya lebih dulu adalah posisi yang baik.
Jangan pernah memosisikan Margn sebagai pengganti `asp-match`; selalu sebagai
lapisan di atasnya.

**Kesegaran data.** Harga dan liveness berubah. Butuh crawl berkala plus probe.
Data basi lebih buruk daripada tidak ada data — `verify()` harus selalu live,
tidak boleh dari cache.

**Pasar masih kecil.** 140 agent. Nilai routing tumbuh seiring jumlah penyedia.
Jawaban jujurnya: selisih 500× sudah nyata **hari ini**, di pasar sekecil ini.

**Menghakimi ASP lain itu sensitif.** Margn memeringkat pesaing satu sama lain.
Jaga agar peringkatnya transparan dan berbasis fakta terukur — harga, liveness,
skor platform sendiri. Jangan pernah pakai penilaian kualitas subjektif.

---

## 8. Yang masih perlu dikerjakan

- Uji `asp-match` di lebih banyak kebutuhan untuk memastikan kesenjangan ranking
  konsisten, bukan kebetulan satu kasus.
- Tentukan kebijakan cache: harga boleh di-cache, liveness tidak boleh.
- Ukur latensi — router yang dipanggil sebelum setiap pembelian harus cepat.
- Daftarkan identitas ber-peran ASP (`pre-check --role asp` sudah mengembalikan
  `canCreate: true`).
- Klarifikasi tanggal submission: HackQuest menyebut 27 Juli 22:59 UTC, FAQ di
  halaman yang sama menyebut 2–17 Juli.

> **Catatan metodologi.** Probe endpoint mencakup 160 dari 359 URL unik;
> sisanya tidak terbaca dalam proses itu, jadi angka kesehatan endpoint adalah
> sampel, bukan sensus. Angka agent, layanan, harga, dan `asp-match` adalah
> pengukuran penuh.
