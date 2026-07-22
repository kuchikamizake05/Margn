# Margn Brainstorming Archive

Folder ini menyimpan lima hipotesis produk Margn. Semua masih berstatus
brainstorming dan belum ada keputusan arah produk.

1. [Ide 1 — Autonomous CFO](MARGN-v1-cfo.md): CFO luas untuk pricing,
   counterparty risk, negosiasi, dan strategi portfolio ASP.
2. [Ide 2 — Margin Engine](MARGN-v2-margin-engine.md): revenue, inference cost,
   reconciliation, dan price floor.
3. [Ide 3 — Marketplace Router](MARGN-v3-router.md): membantu pembeli menilai
   ASP berdasarkan harga, liveness, reputasi, dan track record.
4. [Ide 4 — Profitability Copilot](MARGN-v4-profitability-copilot.md): diagnosis
   unit economics penjual ASP dan rekomendasi price floor.
5. [Ide 5 — Margin-at-Risk Underwriter](MARGN-v5-margin-at-risk.md): mengukur
   loss-call distribution dan mensimulasikan pricing/operational guardrail.

---

## Cara benchmark

Agar riset tebal tidak otomatis dianggap sebagai produk terbaik, penilaian
dipisahkan menjadi dua:

1. **Kualitas bukti:** seberapa kuat masalah telah diukur.
2. **Potensi produk:** seberapa bernilai, berbeda, feasible, dan demoable solusi
   yang diusulkan.

Skor berikut adalah decision aid internal, bukan prediksi juri. Skala 1–5 dan
berdasarkan isi dokumen per 22 Juli 2026.

### Kualitas dokumen riset

| Ide | Metode tertulis | Fakta vs asumsi | Hitungan reproducible | Benchmark kompetitor | Falsification | Core thesis terukur |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sebagian | Sebagian | Belum | Sebagian | Belum | Belum |
| 2 | Ada | Sebagian | Ada | Sebagian | Sebagian | Sebagian |
| 3 | Ada | Sebagian | N/A | Ada | Sebagian | Sebagian |
| 4 | Ada | Ada | Ada | Ada | Ada | **Belum: perlu trace ASP** |
| 5 | Ada | Ada | Ada | Ada | Ada | **Belum: perlu distribusi trace** |

Tabel ini menilai kualitas kerangka berpikir, bukan membuktikan produknya benar.
Kekuatan baru Ide 4/5 adalah batas klaim dan rencana falsification yang eksplisit;
kelemahannya tetap sama: data internal ASP belum tersedia.

### Rubrik potensi produk

| Dimensi | Bobot | Pertanyaan |
| --- | ---: | --- |
| Evidence | 25% | Apakah masalah diukur dengan data yang dapat diaudit? |
| User value | 20% | Apakah hasil mengubah keputusan penting pengguna? |
| ASP-native fit | 15% | Apakah produk memanfaatkan mekanisme OKX.AI? |
| Differentiation | 15% | Apakah berbeda dari tool/proyek yang sudah ada? |
| Deadline feasibility | 15% | Bisakah versi credible live sebelum deadline? |
| Demoability | 10% | Bisakah value terlihat jelas dalam 90 detik? |

### Hasil sementara

| Ide | Evidence | User value | ASP fit | Different. | Feasible | Demo | Weighted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 — Autonomous CFO | 2 | 4 | 5 | 4 | 2 | 3 | **3,25** |
| 2 — Margin Engine | 4 | 4 | 5 | 4 | 3 | 4 | **4,00** |
| 3 — Marketplace Router | 4 | 4 | 5 | 2 | 4 | 5 | **3,95** |
| 4 — Profitability Copilot | 3 | 4 | 5 | 4 | 4 | 4 | **3,90** |
| 5 — Margin-at-Risk | 2 | 4 | 5 | 5 | 3 | 5 | **3,75** |

### Interpretasi jujur

- **Ide 1** memiliki visi luas, tetapi terlalu banyak dependency untuk deadline.
- **Ide 2** masih tipis memimpin gabungan evidence dan completeness, tetapi raw
  dataset belum committed dan scope perlu dipotong agar tidak menjadi platform.
- **Ide 3** memiliki bukti marketplace paling dramatis dan demo kuat. Nilai
  diferensiasinya turun karena buyer-side routing/pre-purchase tooling memiliki
  pembanding dekat, termasuk Tender/cachet, dan human confirmation perlu dihormati.
- **Ide 4** paling seimbang untuk dibangun: scope sempit, pain masuk akal, dan
  integrasi dapat nyata. Evidence masih 3 karena belum ada trace ASP pilot,
  invoice reconciliation, atau interview.
- **Ide 5** paling khas secara konsep, tetapi thesis tail risk masih didukung
  stress test, belum data aktual. Evidence sengaja hanya 2 sampai ada distribution
  trace dan policy replay nyata.

Selisih 0,05–0,25 tidak signifikan. Data baru dapat mengubah urutan. Dokumen ini
tidak menetapkan pemenang brainstorming; ia menunjukkan bukti apa yang masih
dibutuhkan oleh masing-masing ide.
