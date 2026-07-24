# Margn — Skrip Demo 90 Detik

Semua perintah di bawah sudah terbukti jalan (24 Juli 2026). Terminal asli, tanpa
slide. Sebut ASP lain **pakai ID, bukan nama** — mereka peserta lain (§8
`MARGN-VERIFIED.md`).

---

## ⚠️ Prep wajib di HARI REKAM (bukan sebelumnya)

Pasar bergerak ~2.000 transaksi/hari; target bisa berubah mati↔hidup. Jalankan
urut, pagi sebelum rekam:

```bash
cd research/marketplace-scan
python3 scan.py                              # snapshot baru
python3 matchtest.py | tee matchtest-$(date +%Y-%m-%dT%H%M).txt   # ranking gap masih ada?
python3 find-dead-demo-target.py             # target mati yang masih mati hari ini
cd ../../endpoint && npm run build:snapshot  # refresh snapshot yang dipakai Worker
npx wrangler deploy                          # deploy snapshot baru (URL & registry TIDAK berubah)
```

Lalu konfirmasi ulang tiap target yang akan kamu tunjuk di kamera:

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"<DEAD_ID>"}'   # harus alive:false
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"<LIVE_ID>"}'   # harus alive:true
```

**Jangan** `onchainos agent update` — memicu QA ulang saat pending. `wrangler
deploy` aman: mengubah kode/snapshot di balik URL yang sama, registry tak
tersentuh.

**Target per 24 Juli** (ganti kalau prep menemukan yang lebih bersih):
- Mati: `#5053` atau `#4999` — tunnel ephemeral, mati permanen, `alive:false`
- Hidup: `#5524` atau `#1500` — konfirmasi dulu `alive:true`

---

## Beat 1 · 0–15 dtk · Provider mati yang tak terdeteksi

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"5053"}'
```
Muncul: `"alive": false … "http_status": 530`.

> "Platform menandai provider ini **online**. Margn memprobenya langsung —
> mati. Pembeli akan membayar layanan yang tidak bisa jalan, dan tidak ada
> yang memberitahunya."

Lalu angka sistematisnya (dari `find-dead-demo-target.py`):

> "Dan ini bukan satu kasus. **26 dari 563 agent yang OKX tandai online
> ternyata mati.** Flag-nya tidak bisa dipercaya. Satu-satunya kebenaran
> adalah probe langsung."

Kontras cepat — ASP sehat:
```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \
  -H 'content-type: application/json' -d '{"agentId":"5524"}'
```
> "Yang ini hidup. Biner. Tidak bisa dibantah."

---

## Beat 2 · 15–50 dtk · Ranking gap — inti bukti

Jalankan `asp-match` bawaan OKX, layar penuh, tidak dipotong:
```bash
onchainos agent asp-match --task-desc "get latest crypto news headlines"
```

Zoom ke dua baris (angka pasti diambil dari `matchtest` hari rekam):

> "Peringkat 3: **$0.55 · keamanan 2.0 · 1 penjualan.** Peringkat 5: **$0.01 ·
> keamanan 5.0 · 1.670 penjualan** — lebih baik di setiap metrik yang OKX ukur
> sendiri, tapi diperingkat **di bawahnya**."

> "Ini API OKX sendiri. Jalankan perintah yang sama sekarang juga."

Sistematis:

> "Diuji pada 7 kebutuhan yang bisa dijalankan. **7 dari 7**, opsi
> terbaik-menurut-nilai kalah dari opsi yang lebih mahal dan lebih buruk.
> Retrieval-nya bagus. Ranking-nya belum ada."

**Framing yang benar:** bukan "asp-match rusak" — retrieval memang tugasnya dan
itu jalan. Yang belum lahir adalah **lapisan ranking di atasnya.** Margn mengisi
lapisan itu, bukan menggantikan asp-match.

---

## Beat 3 · 50–75 dtk · Margn mengisi kartu

Kartu konfirmasi pembeli hanya menampilkan Provider + Price. Margn menambah
konteks yang hilang:

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/quote \
  -H 'content-type: application/json' -d '{"need":"crypto news"}'
```
> "Rentang harga pasar untuk kebutuhan ini: min · median · maks."

```bash
curl -sS -X POST https://margn.margnhq.workers.dev/v1/check \
  -H 'content-type: application/json' -d '{"agentId":"5053","price":0.55}'
```
> "Gabungan: hidup atau mati, plus posisi harga terhadap pasar —
> '27× di atas median'. Konteks, bukan vonis 'terbaik'."

> "Sinyalnya sudah ada di API OKX sejak awal. Tidak ada yang membacanya."

---

## Beat 4 · 75–90 dtk · Tutup

> "Tiga tool. `verify` — hidup atau mati sekarang. `quote` — rentang harga
> pasar. `check` — keduanya sekaligus. Semua fakta terukur, tidak pernah
> menghakimi kualitas."

Tunjukkan Margn adalah ASP live sungguhan (kalau sudah approved: screenshot
listing #8646; kalau belum: `agent service-list --agent-id 8646` menampilkan 3
service terdaftar). Selesai.

---

## Aturan (jangan dilanggar)

- Terminal asli, tanpa slide.
- ASP lain disebut **pakai ID**, tidak pakai nama.
- **Jangan** sembunyikan latensi probe — itu justru buktinya nyata.
- **Jangan** bilang "kami memperbaiki OKX" → "kami membaca sinyal yang sudah
  ada di sana".
- **Jangan** pakai kata "terbaik" di mana pun.
- Angka apa pun yang muncul di layar harus dari run **hari rekam**, bukan disalin
  dari dokumen.

## Utang yang sebaiknya beres sebelum rekam (Sako, S4)

`quote("crypto news")` sekarang menghasilkan 415 match dengan maks $66 — matching
token `crypto` terlalu longgar, rentang harganya melebar dan bisa dipertanyakan
juri. Perketat matching (butuh ≥2 token, atau bobot frasa) supaya rentang yang
tampil di Beat 3 masuk akal. Ini kode di balik URL — aman, tidak menyentuh
registry. Kalau belum sempat, pilih `need` yang lebih spesifik saat rekam dan tes
rentangnya dulu.
