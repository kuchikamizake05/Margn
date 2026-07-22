# Ide 4 — Protokol Evidence Gratis untuk Fixed-Price ASP

**Status:** rancangan eksperimen; belum dijalankan<br>
**Tanggal preregistrasi:** 23 Juli 2026<br>
**Tujuan:** menguji apakah variasi biaya inferensi cukup besar untuk mendukung masalah yang ingin diselesaikan MARGN Profitability Copilot, tanpa API berbayar, aplikasi produksi, atau responden.

## 1. Keputusan yang ingin dibantu

Eksperimen ini tidak dimaksudkan untuk membuktikan bahwa semua ASP di OKX.AI salah harga. Pertanyaan yang lebih sempit dan dapat diuji adalah:

> Pada tarif model resmi, berapa harga tetap yang dibutuhkan sebuah layanan long-context question answering agar setidaknya 95% workload yang kompatibel tidak rugi dan mencapai target gross margin 30%?

Hasilnya akan dipakai untuk memutuskan apakah mekanisme inti Ide 4—mengukur biaya per order dan memberi guardrail harga—layak dipertahankan, dipersempit, atau ditinggalkan.

## 2. Mengapa eksperimen ini relevan

[LongBench v2](https://github.com/THUDM/LongBench) berisi 503 soal multiple-choice dengan konteks sekitar 8 ribu hingga 2 juta kata, enam kategori tugas, dan label panjang `short`, `medium`, serta `long`. Bentuk jawabannya hanya A/B/C/D, sehingga benchmark ini mengisolasi variasi biaya input dengan biaya output yang sangat kecil.

Ini adalah **rekonstruksi biaya**, bukan penggunaan ASP nyata. Kekuatan evidence yang mungkin dihasilkan:

- cukup kuat untuk menunjukkan apakah variasi workload secara mekanis dapat menciptakan risiko margin;
- cukup kuat untuk membandingkan pengaruh model, panjang konteks, harga jual, dan context cap;
- tidak cukup untuk membuktikan bahwa ASP operator membutuhkan produk ini atau bersedia membayar;
- tidak cukup untuk mengklaim adanya kerugian aktual pada seller tertentu.

## 3. Hipotesis dan aturan falsifikasi

### Hipotesis utama

- **H0 — variasi tidak material:** untuk kedua model, rasio `P95 cost / P50 cost < 3` dan tingkat kegagalan mencapai margin 30% pada harga USD 0,01 tidak lebih dari 10%.
- **H1 — variasi material:** sedikitnya satu konfigurasi model memiliki `P95 cost / P50 cost >= 3` atau tingkat kegagalan mencapai margin 30% pada harga USD 0,01 lebih dari 10%.

### Aturan interpretasi

- Jika H0 bertahan pada kedua model dan seluruh analisis sensitivitas, evidence untuk proposisi “biaya tersembunyi dan sangat bervariasi” dianggap lemah.
- Jika H1 hanya terjadi pada konteks yang melewati cap 128k, temuan harus dibingkai sebagai kebutuhan **context guardrail**, bukan masalah salah harga yang berlaku umum.
- Jika banyak workload melewati context window model, temuan tersebut adalah masalah kompatibilitas, bukan bukti kerugian.
- Hasil yang bertentangan dengan Ide 4 tetap dilaporkan; threshold tidak boleh diubah setelah hasil terlihat.

## 4. Material Passport

| Komponen | Pilihan yang dipatok | Alasan |
|---|---|---|
| Dataset | `THUDM/LongBench-v2`, split `train` | Publik, gratis, 503 workload long-context, skema jelas |
| Revisi dataset | Commit/revision hash dicatat saat pengunduhan | Membuat hasil dapat direproduksi |
| Populasi analisis | Seluruh 503 row yang lolos validasi skema | Tokenisasi lokal gratis; sensus menghindari bias sampling |
| Audit subset | 99 row: 33 `short`, 33 `medium`, 33 `long` | Pengecekan manual dan reproducibility lintas strata; bukan denominator utama |
| Seed | `20260723` | Sampling dan bootstrap deterministik |
| Model tarif | GPT-5.4 nano dan GPT-5.4 mini | Membandingkan opsi murah dan lebih kuat dalam keluarga yang sama |
| Context window | 400.000 token untuk kedua model | Batas yang tercantum di dokumentasi resmi pada 23 Juli 2026 |
| Tokenizer | `tiktoken.encoding_for_model(model_id)`; fallback `o200k_base` | Gratis dan dapat dijalankan lokal |
| Harga jual | USD 0,001; 0,005; 0,01; 0,05 per order | Grid sensitivitas, bukan klaim median marketplace |
| Margin target | 30% | Target eksplisit untuk mengubah cost menjadi price floor |
| Infrastruktur/tools | USD 0 pada baseline | Membuat estimasi sebagai lower bound konservatif |
| Retry | 0% pada baseline; 1%, 5%, 10% pada sensitivitas | Memisahkan hasil observasi dari asumsi operasional |

Tarif yang dipatok per 1 juta token, berdasarkan halaman resmi yang diakses 23 Juli 2026:

| Model | Input | Output | Context window |
|---|---:|---:|---:|
| [GPT-5.4 nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano) | USD 0,20 | USD 1,25 | 400.000 token |
| [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini) | USD 0,75 | USD 4,50 | 400.000 token |

Cached-input discount dan Batch API tidak dipakai pada baseline karena layanan on-demand tidak dapat diasumsikan selalu mendapatkannya. Regional processing uplift juga tidak dipakai; keduanya dapat ditambahkan sebagai skenario lanjutan.

## 5. Unit analisis dan konstruksi request

Satu row LongBench v2 diperlakukan sebagai satu order. Input sintetis disusun konsisten dari:

1. instruksi singkat untuk memilih A/B/C/D;
2. `context`;
3. `question`;
4. `choice_A` sampai `choice_D`.

Output proxy adalah ground-truth answer satu huruf. Eksperimen tidak memanggil model dan tidak mengukur akurasi. Karena itu, angka output hanya merepresentasikan format jawaban minimum, bukan reasoning token aktual.

Setiap row harus menyimpan `_id`, domain, sub-domain, difficulty, label length, input token count, output token count, status kompatibilitas, serta reconstructed cost untuk tiap model. Isi konteks mentah tidak disimpan ke Git.

## 6. Sampling dan validasi

1. Unduh split `train` dan catat revision hash, waktu akses, jumlah row, serta checksum manifest.
2. Validasi keberadaan `_id`, `length`, `question`, empat pilihan, `answer`, dan `context`.
3. Tolak row hanya jika skema tidak lengkap atau `_id` duplikat; alasannya harus dicatat.
4. Kelompokkan berdasarkan label resmi `short`, `medium`, `long`.
5. Hitung metric utama pada seluruh row valid dengan distribusi dataset apa adanya.
6. Untuk audit subset, gunakan seed `20260723`, acak tiap kelompok, lalu pilih 33 row pertama.
7. Jika satu kelompok memiliki kurang dari 33 row valid, gunakan semuanya dan laporkan shortfall; jangan mengganti definisi strata.
8. Jangan mengecualikan row karena menghasilkan biaya tinggi.

Audit subset 99 row tidak boleh menggantikan sensus sebagai denominator utama. Ringkasannya hanya digunakan untuk memeriksa bahwa pipeline menghasilkan pola yang masuk akal pada tiap strata.

## 7. Formula

Untuk model `m` dan order `i`:

```text
input_cost(i,m)  = input_tokens(i,m)  / 1,000,000 * input_rate(m)
output_cost(i,m) = output_tokens(i,m) / 1,000,000 * output_rate(m)
cost(i,m)        = input_cost(i,m) + output_cost(i,m)

cash_margin(i,m,p)       = (p - cost(i,m)) / p
price_floor_30(i,m)      = cost(i,m) / (1 - 0.30)
cash_loss(i,m,p)         = cost(i,m) > p
target_margin_fail(i,m,p)= price_floor_30(i,m) > p
```

`cash_loss` dan `target_margin_fail` harus dilaporkan terpisah. Seluruh nilai uang disimpan tanpa pembulatan pada data per-call; pembulatan hanya untuk tabel presentasi.

## 8. Skenario eksperimen

### A. Full-context baseline

- Request utuh dihitung selama total token tidak melebihi 400.000.
- Request di atas batas diberi status `infeasible_for_model` dan tidak boleh diam-diam dipotong.
- Primary metric dihitung hanya pada workload kompatibel, sementara incompatibility rate tetap dilaporkan.

### B. Guardrail simulation

Simulasikan cap 32k dan 128k token. Order di atas cap diberi status `rejected_by_guardrail`; konteks tidak dipotong karena pemotongan akan mengubah semantik tugas.

Untuk setiap cap, laporkan:

- acceptance dan rejection rate;
- P50/P95 cost di antara order yang diterima;
- cash-loss rate dan target-margin-failure rate pada setiap harga jual.

### C. Sensitivity analysis

- token estimate `-10%`, baseline, dan `+10%` untuk mengakui kemungkinan beda tokenizer/billing;
- full retry pada 1%, 5%, dan 10% order, dipilih deterministik dengan seed yang sama;
- hasil per label length dan domain untuk mengetahui apakah temuan hanya didorong satu jenis workload.

## 9. Metrics dan decision gates

### Primary metric

`target-margin-failure rate` pada harga USD 0,01, full-context baseline, pada seluruh workload kompatibel untuk masing-masing model.

### Secondary metrics

- cash-loss rate pada seluruh price grid;
- reconstructed cost P50, P90, P95, P99, minimum, dan maksimum;
- rasio P95/P50;
- P95 price floor untuk margin 30%;
- incompatibility rate dan guardrail rejection rate;
- hasil per strata dan domain;
- leave-one-domain-out robustness check untuk melihat apakah kesimpulan berubah ketika satu domain dikeluarkan.

LongBench v2 diperlakukan sebagai finite benchmark set. Karena analisis utamanya berupa sensus, eksperimen tidak memakai confidence interval atau p-value yang dapat memberi kesan seolah dataset ini adalah sampel acak dari seluruh workload ASP.

### Keputusan setelah eksperimen

| Hasil | Implikasi bagi Ide 4 |
|---|---|
| H1 terpenuhi dan tetap stabil pada sensitivitas ±10% | Evidence mekanisme biaya cukup kuat; lanjutkan MVP guardrail/profitability copilot |
| H1 hanya pada model mini | Positioning dipersempit ke ASP yang memakai model lebih mahal |
| H1 hanya pada konteks >128k | Prioritaskan pre-purchase context cap/routing; jangan mengklaim masalah harga umum |
| H0 bertahan pada seluruh konfigurasi | Turunkan prioritas Ide 4 atau cari workflow dengan tool/retry cost yang benar-benar terukur |

## 10. Artefak yang harus dihasilkan saat implementasi

```text
research/fixed-price-benchmark/
  config.json
  data/
    dataset-manifest.csv
    rate-cards.json
  results/
    per-call-costs.csv
    summary.json
    figures/
      cost-distribution.svg
      price-coverage.svg
  REPORT.md

scripts/
  run_fixed_price_benchmark.py
```

Perintah yang direncanakan:

```powershell
python scripts/run_fixed_price_benchmark.py --config research/fixed-price-benchmark/config.json
```

Eksperimen harus berjalan tanpa API key, GPU, akun berbayar, atau request inferensi. Dependensi yang diizinkan: Python 3.11+, `datasets`, dan `tiktoken`; pustaka plotting gratis boleh ditambahkan bila diperlukan.

## 11. Acceptance criteria implementasi

- Dua run dengan config, revision, dan seed yang sama menghasilkan sampel serta summary identik.
- Seluruh row valid masuk analisis utama tepat satu kali; 99 audit ID unik dan komposisinya 33/33/33, kecuali shortfall yang terdokumentasi.
- Formula biaya diuji dengan fixture manual yang hasilnya dapat dihitung tangan.
- Row >400k diberi status incompatible, bukan dipotong atau dimasukkan ke denominator primary metric.
- Output menyebut tokenizer aktual atau proxy yang dipakai.
- Rate card menyimpan URL sumber, nilai, mata uang, unit, dan tanggal akses.
- `REPORT.md` membedakan reconstructed cost, actual billed cost, cash loss, dan target-margin failure.
- Tidak ada dataset context mentah, credential, atau klaim tentang seller tertentu yang masuk Git.

## 12. Monitoring dan batas eksekusi

- Target runtime lokal: kurang dari 30 menit setelah dataset tersedia.
- Progress dicatat per strata dan setiap 10 row.
- Jika satu row gagal ditokenisasi, lanjutkan row berikutnya dan catat error; jangan menggantinya secara manual.
- Jika dataset revision tidak dapat dipatok, eksperimen berhenti sebelum analisis agar hasil tidak tampak reproducible padahal tidak.
- File utama untuk memantau progres: `results/per-call-costs.csv`; completion marker: `results/summary.json`.

## 13. Batas klaim

Kalimat yang boleh dipakai setelah hasil mendukung:

> “Pada seluruh row valid LongBench v2 dan tarif model per 23 Juli 2026, variasi panjang request menghasilkan perbedaan reconstructed inference cost sebesar X; pada harga Y, Z% workload kompatibel gagal mencapai target margin 30%.”

Kalimat yang tidak boleh dipakai tanpa evidence produksi atau wawancara:

- “Mayoritas ASP OKX.AI merugi.”
- “Seller tidak tahu biaya mereka.”
- “MARGN pasti meningkatkan revenue.”
- “Reconstructed cost sama dengan tagihan provider aktual.”

## 14. Follow-up gratis jika hasil menjanjikan

Tanpa responden, evidence berikutnya tetap bisa diperkuat melalui:

1. replay terhadap workload publik kedua yang memiliki tool steps atau output panjang;
2. mock checkout yang memperlihatkan allow/warn/block berdasarkan estimated margin;
3. synthetic order stream untuk menguji alert dan policy engine;
4. publikasi notebook/reproducible report agar orang lain dapat mengkritik asumsi.

Demand evidence tetap merupakan gap. Itu baru dapat dijawab kelak melalui waitlist, penggunaan publik, wawancara, atau seller telemetry—bukan dengan menambah simulasi.

## Sumber utama

- [LongBench v2 repository](https://github.com/THUDM/LongBench)
- [LongBench v2 dataset](https://huggingface.co/datasets/THUDM/LongBench-v2)
- [GPT-5.4 nano model and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-nano)
- [GPT-5.4 mini model and pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
