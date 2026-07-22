# Ide 4: Margn — Profitability Copilot for OKX.AI ASPs

> **Before an ASP sets an x402 price, Margn shows what one call really costs,
> whether the service makes money, and the minimum price required for a target
> gross margin.**

- **Status:** hipotesis brainstorming, bukan keputusan produk.
- **Pembaruan riset:** 22 Juli 2026.
- **Track utama:** Finance Copilot.
- **Tingkat keyakinan:** menengah. Problem dan mekanisme biaya nyata, tetapi belum
  ada telemetry ASP eksternal atau wawancara operator yang membuktikan besarnya pain.

---

## 1. Kesimpulan eksekutif

Ide 4 layak dibawa lebih lanjut karena bentuk produknya sempit, mudah
didemonstrasikan, dan dekat dengan mekanisme bisnis A2MCP: penjual menentukan
harga tetap per call, sedangkan biaya call dapat berubah karena token, model,
tool, retry, dan kegagalan.

Namun, bukti marketplace **belum membuktikan ASP salah menetapkan harga**. Harga
yang sama pada banyak service hanya menunjukkan pola yang perlu diteliti; service
tersebut bisa memakai cache, data statis, atau compute hampir nol. Bukti yang benar
harus menggabungkan dua sisi yang kini terpisah:

1. revenue aktual dari paid call OKX.AI/x402; dan
2. biaya aktual dari provider, tool, retry, serta infrastruktur ASP.

Kontribusi khas Margn bukan sekadar kalkulator token. Produk ini menjadi lapisan
profitabilitas **khusus bisnis ASP**, dengan output price floor, gross margin,
confidence, dan konteks harga marketplace.

---

## 2. Pertanyaan riset dan hipotesis

### Pertanyaan utama

Apakah operator ASP dapat mengetahui gross margin per service dengan cukup akurat
untuk menetapkan harga fixed-per-call yang sehat?

### Hipotesis yang dapat dibantah

> Setelah revenue OKX.AI dan telemetry biaya digabungkan, setidaknya satu service
> ASP pilot akan memiliki selisih lebih dari 10% antara margin yang diperkirakan
> operator dan margin yang dihitung dari call aktual.

Hipotesis ini **gagal** bila:

- operator pilot sudah mengetahui cost per call dengan akurat;
- biaya antar-call hampir konstan dan dapat dihitung dengan kalkulator sederhana;
- selisih estimasi dan realisasi selalu kecil;
- operator tidak mengubah keputusan harga atau operasi setelah melihat hasilnya.

Jadi, “AI calls memiliki biaya” bukan validasi produk. Validasi terjadi hanya jika
ketidakjelasan biaya benar-benar mengubah keputusan ASP.

---

## 3. Cara membaca bukti

| Label | Arti |
| --- | --- |
| **Terukur** | Hasil observasi marketplace atau trace aktual pada tanggal tertentu |
| **Harga resmi** | Tarif yang dipublikasikan provider pada dokumentasi resmi |
| **Asumsi skenario** | Nilai buatan untuk menguji model; bukan fakta marketplace |
| **Turunan** | Hasil rumus dari data dan asumsi yang disebutkan |
| **Belum diketahui** | Data internal ASP yang tidak tersedia secara publik |

Pemisahan ini penting. Dokumen lama mencampur pola marketplace dengan kesimpulan
tentang profitabilitas. Versi ini tidak menganggap harga murah sebagai rugi atau
harga mahal sebagai untung tanpa mengetahui biaya internal penjual.

---

## 4. Dasar empiris

### 4.1 Mekanisme platform yang terverifikasi

Dokumentasi resmi OKX menyatakan bahwa A2MCP dapat berupa service gratis atau
berbayar dengan x402, memakai harga per call, endpoint HTTPS, dan otomatis ditagih
ketika dipanggil. Saat registrasi, ASP memasukkan nama, deskripsi, price per call,
dan endpoint. Unit ekonomi dasarnya memang `revenue per call` melawan
`cost per call`.

Sumber primer:

- [OKX A2MCP guide](https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp)
- [OKX ASP registration guide](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp)
- [OKX.AI Marketplace](https://www.okx.ai/agents)

### 4.2 Snapshot marketplace lokal, 22 Juli 2026

Catatan riset lokal `MARGN-VERIFIED.md` mencatat union 44 query
`onchainos agent search` dan melaporkan:

| Metrik | Hasil terukur |
| --- | ---: |
| Agent unik | 985 |
| Service | 2.344 |
| Service berbayar | 2.180 |
| Service gratis | 159 |
| Harga minimum–maksimum | $0,000001–$5,00 |
| Harga yang paling sering muncul | $0,01 (300 service) |
| Agent tanpa penjualan | 547 (55,5%) |

Angka tersebut menunjukkan pasar yang besar, price dispersion ekstrem, dan adopsi
yang tidak merata. Angka itu **tidak** menunjukkan struktur biaya atau membuktikan
mispricing.

#### Keterbatasan reproduksibilitas

- Raw JSON/CSV snapshot dan script scan belum disimpan di repository.
- CLI `onchainos` tidak tersedia pada shell yang dipakai untuk revisi dokumen
  ini, sehingga sensus tidak dijalankan ulang.
- Data marketplace dapat berubah setelah 22 Juli 2026.
- Karena itu angka di atas layak sebagai bukti eksplorasi, bukan dataset audit.

Sebelum dipakai di submission, scanner, timestamp, query list, deduplication rule,
dan raw output harus disimpan agar juri dapat mereplikasi hasilnya.

### 4.3 Fakta yang belum tersedia

Marketplace tidak mengungkapkan:

- model dan token yang dipakai setiap ASP;
- provider invoice;
- biaya API/tool pihak ketiga;
- retry dan failed execution;
- biaya infrastruktur;
- refund, fee, atau reconciliation per order.

Inilah missing join yang hendak diisi Margn. Tanpa data tersebut, klaim
profitabilitas service lain tidak boleh dibuat.

---

## 5. Mengapa cost per call mudah salah

Satu harga fixed-per-call dapat membiayai beban yang berbeda-beda:

- panjang input dan output tidak tetap;
- cached token memiliki tarif berbeda;
- model dapat berubah karena fallback;
- tool atau search grounding dapat mengenakan biaya terpisah;
- satu request pengguna dapat menjalankan beberapa attempt;
- timeout tetap membakar compute;
- image service dapat membuat beberapa candidate sebelum memilih satu hasil;
- biaya provider dapat berubah berdasarkan tanggal atau context window.

OpenTelemetry sudah mendefinisikan atribut seperti
`gen_ai.usage.input_tokens`, `output_tokens`, cache read/create, dan reasoning
tokens. Margn sebaiknya menerima telemetry yang sudah ada, bukan memaksa ASP
memasang observability baru.

Sumber primer:

- [OpenTelemetry GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
- [OpenTelemetry GenAI metrics](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-metrics.md)

Provider dapat melaporkan cached token secara inklusif atau eksklusif. Margn harus
menormalisasi bucket agar token tidak dihitung dua kali.

---

## 6. Model perhitungan

Untuk call ke-`i`:

```text
net_revenue_i = paid_price_i - refund_i - payment_fee_i

llm_cost_i = Σ attempts(
  uncached_input_tokens × input_rate
  + cache_read_tokens × cache_read_rate
  + cache_write_tokens × cache_write_rate
  + output_tokens × output_rate
  + other_metered_usage
)

total_cost_i = llm_cost_i
             + tool_cost_i
             + infrastructure_cost_i
             + other_variable_cost_i

gross_profit_i = net_revenue_i - total_cost_i
gross_margin_i = gross_profit_i / net_revenue_i
```

Untuk sekumpulan call:

```text
service_gross_margin = Σ(net_revenue_i - total_cost_i) / Σ(net_revenue_i)
average_cost_per_paid_call = Σ(total_cost_i) / count(paid_calls)
price_floor = expected_cost_per_call / (1 - target_margin)
```

### Aturan agar angka tidak menipu

- Rate model wajib memiliki provider, model ID, mata uang, dan tanggal berlaku.
- Retry dihitung sebagai attempt aktual, bukan `retry_count × first cost`.
- Failed call tetap dicatat bila compute sudah terpakai.
- Refund dan fee tidak diasumsikan nol bila datanya belum diketahui.
- USDT dan USD ditampilkan terpisah. Skenario di bawah mengasumsikan
  `1 USDT ≈ $1` hanya untuk memudahkan analisis.
- Gross margin bukan net profit; tenaga kerja, pajak, dan overhead tetap tidak
  otomatis termasuk.

---

## 7. Tiga studi kasus yang dapat direplikasi

Semua kasus berikut adalah **skenario**, bukan telemetry ASP peserta. Tarif model
berasal dari halaman resmi provider yang diakses 22 Juli 2026.

### Kasus A — classifier murah belum tentu aman di harga mikro

**Asumsi:** GPT-5.4 nano, 2.000 input token, 300 output token, dan biaya infra
$0,0002. Harga resmi: $0,20/1M input dan $1,25/1M output.

```text
input  = 2.000 × $0,20 / 1.000.000 = $0,000400
output =   300 × $1,25 / 1.000.000 = $0,000375
infra  =                                  $0,000200
total  =                                  $0,000975
```

| Selling price | Profit/call | Gross margin |
| ---: | ---: | ---: |
| $0,001 | $0,000025 | 2,5% |
| $0,010 | $0,009025 | 90,25% |

Perbedaan satu digit pada harga mikro mengubah economics secara drastis. Angka
ini belum memasukkan retry, fee, atau refund.

### Kasus B — research call memiliki ruang margin tipis

**Asumsi:** GPT-5.4 mini, 20.000 input token dan 5.000 output token. Harga resmi:
$0,75/1M input dan $4,50/1M output.

```text
input  = 20.000 × $0,75 / 1.000.000 = $0,0150
output =  5.000 × $4,50 / 1.000.000 = $0,0225
total model                            = $0,0375
```

Pada selling price $0,05, gross margin sebelum tool dan infra adalah 25%.
Satu retry penuh membuat compute menjadi $0,075 dan call rugi $0,025.

### Kasus C — jumlah candidate mengubah economics image service

**Asumsi:** Gemini 2.5 Flash Image sekitar $0,039 per image 1024px; selling price
$0,15; biaya input dan infra diabaikan agar contoh sederhana.

| Candidate yang dibuat | Generation cost | Gross margin sebelum infra |
| ---: | ---: | ---: |
| 1 | $0,039 | 74% |
| 2 | $0,078 | 48% |
| 3 | $0,117 | 22% |

Selling price yang sama dapat sangat profitable atau hampir tidak aman, tergantung
policy internal yang tidak terlihat di marketplace.

Sumber tarif:

- [OpenAI GPT-5.4 nano pricing](https://developers.openai.com/api/docs/models/gpt-5.4-nano)
- [OpenAI GPT-5.4 mini pricing](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
- [Google Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

## 8. Bentuk produk

### Hero workflow

```text
Import trace/cost export
        ↓
Join dengan paid call dan selling price
        ↓
Normalisasi rate berdasarkan provider + model + tanggal
        ↓
Hitung cost, profit, margin, dan confidence
        ↓
Simulasikan price floor atau operational change
```

### Empat tool inti

| Tool | Input | Output |
| --- | --- | --- |
| `analyze_call` | usage, attempt, tool cost, price | cost dan profit satu call |
| `analyze_service` | kumpulan call | weighted gross margin, retry/failure cost |
| `recommend_price` | expected cost, target margin | price floor + missing-cost warnings |
| `simulate_policy` | price/model/cache/retry scenario | dampak pada profit dan margin |

### Confidence, bukan angka palsu yang presisi

```json
{
  "gross_margin": 0.298,
  "confidence": "medium",
  "missing_costs": ["payment_fee", "fixed_infrastructure_allocation"],
  "rate_card_as_of": "2026-07-22"
}
```

MVP dapat menerima input manual dan JSON/CSV export. Integrasi pertama sebaiknya
OpenTelemetry atau Langfuse export, bukan custom SDK.

---

## 9. Benchmark produk berdekatan

| Produk | Yang sudah kuat | Gap terhadap use case Margn |
| --- | --- | --- |
| [Langfuse](https://langfuse.com/docs/observability/features/token-and-cost-tracking) | Trace, token, model cost, custom cost, metrics | Tidak khusus menggabungkan listing price dan settlement OKX.AI menjadi margin per ASP service |
| [Helicone](https://www.helicone.ai/) | AI gateway, observability, cost monitoring | Fokus provider spend; bukan price-floor workflow penjual OKX.AI |
| [Portkey](https://portkey.ai/docs/product/ai-gateway/virtual-keys/budget-limits) | Gateway, budget cap, alert, routing | Budget control tidak sama dengan revenue-to-cost profitability |
| [OpenMeter](https://openmeter.io/docs) | Usage metering dan billing infrastructure | Komponen generik; belum memberikan diagnosis ASP dan marketplace context |
| [Tender / cachet](https://github.com/wngstnr-code/cachet) | Membantu sisi pembeli memilih atau menjalankan service | Margn bekerja di sisi penjual: biaya, margin, dan harga |

### Diferensiasi yang dapat dipertahankan

Margn tidak perlu mengalahkan observability platform. Ia mengonsumsinya lalu
melakukan join yang spesifik:

```text
provider/tool cost + attempts + OKX paid price + service identity
                              ↓
             ASP profitability decision
```

Jika produk hanya menampilkan token cost, ia kalah dari tool yang sudah matang.
Jika produk merekonsiliasi call berbayar dan memberi rekomendasi yang dapat
ditindaklanjuti, posisinya lebih khas.

---

## 10. Demo 90 detik

| Waktu | Adegan | Bukti yang harus terlihat |
| --- | --- | --- |
| 0–10 dtk | ASP menjual research service $0,05/call | Listing/price nyata atau staging yang diberi label |
| 10–25 dtk | Import trace dengan token, tool, dan retry | Raw input tidak disembunyikan |
| 25–40 dtk | Margn merekonsiliasi cost $0,0375 sebelum tool | Formula dan rate-card date |
| 40–55 dtk | Satu retry membuat call rugi | Profit per attempt dan total |
| 55–70 dtk | Target margin 30% menghasilkan price floor | Missing-cost warning tetap terlihat |
| 70–82 dtk | Bandingkan dengan price distribution marketplace | Benchmark sebagai konteks, bukan vonis |
| 82–90 dtk | Margn menganalisis biaya call Margn sendiri | Meta-demo yang membuktikan integrasi |

Klaim demo harus memakai trace nyata atau memberi watermark **illustrative
scenario**. Jangan menyebut service peserta lain rugi tanpa data internal mereka.

---

## 11. Kecocokan hackathon

| Award | Fit | Alasan |
| --- | --- | --- |
| **Finance Copilot** | Kuat | Menghitung unit economics dan membantu keputusan pricing bisnis ASP |
| **Best Product** | Menengah–kuat | Workflow dapat sangat jelas dan end-to-end |
| **Creative Genius** | Menengah | Meta-service cukup khas, tetapi kalkulator saja tidak kreatif |
| **Revenue Rocket** | Lemah untuk deadline | Membutuhkan order dan review aktual |
| **Software Utility** | Menengah | Bentuknya developer utility, tetapi framing keuangan dominan |

Winnability tidak dapat disimpulkan dari ide saja. Peluangnya naik bila ada satu
ASP pilot, trace nyata, dan perubahan harga/policy yang terbukti; tanpa itu juri
bisa melihatnya sebagai spreadsheet dengan UI.

---

## 12. Risiko, counter-evidence, dan mitigasi

| Risiko | Dampak | Cara menguji/mitigasi |
| --- | --- | --- |
| Pain tidak cukup besar | Tidak ada willingness to use | Wawancara 5 ASP dan minta mereka menghitung margin tanpa bantuan |
| Telemetry tidak lengkap | Hasil presisi palsu | Confidence score dan missing-cost list |
| Provider sudah menyediakan cost | Margn tampak redundan | Fokus pada join revenue OKX + tool + retry |
| Harga provider berubah | Rekomendasi basi | Versioned rate card dan timestamp |
| Flat price bukan mispricing | Narasi riset runtuh | Jangan gunakan flat price sebagai bukti rugi |
| Payment/refund semantics belum jelas | Reconciliation salah | Validasi terhadap satu settlement end-to-end |
| Data sensitif | ASP enggan mengirim trace | Redaction, local import, simpan agregat minimal |
| Deadline sangat dekat | Integrasi penuh tidak selesai | MVP manual import + satu real ASP trace |

---

## 13. Rencana validasi sebelum coding besar

1. **Reproduce marketplace scan.** Commit script, query list, raw timestamped
   output, dan deduplication rule.
2. **Interview lima operator ASP.** Tanyakan cara menentukan harga, bukan apakah
   mereka “suka ide Margn”.
3. **Kumpulkan minimal 100 trace dari satu service.** Cocokkan hasil Margn dengan
   provider invoice; target error agregat di bawah 2%.
4. **Reconcile satu paid flow.** Pastikan definisi revenue, failure, refund, dan
   fee sesuai kenyataan OKX.AI.
5. **Jalankan shadow recommendation.** Ukur apakah operator mengubah harga,
   model, cache, atau retry policy.
6. **Tetapkan go/no-go.** Lanjut bila ditemukan material margin blind spot atau
   keputusan operasional nyata. Hentikan bila hanya menggandakan cost dashboard.

---

## 14. Definition of done untuk prototipe

- menerima minimal satu format telemetry standar dan input manual;
- memakai rate card bertanggal dan unit yang eksplisit;
- menghitung attempt, retry, failed call, tool cost, dan missing cost;
- hasil agregat cocok dengan provider invoice dalam toleransi yang ditetapkan;
- menggabungkan selling price/paid call dengan biaya aktual;
- price floor memiliki automated test untuk edge cases;
- satu studi kasus memakai data nyata dengan izin pemilik;
- ASP listing live dan demo maksimal 90 detik dapat direproduksi.

---

## 15. Sumber dan provenance

Diakses 22 Juli 2026 kecuali disebut lain:

1. [OKX — How to create an A2MCP service](https://web3.okx.com/onchainos/dev-docs/okxai/howtomcp)
2. [OKX — Register ASP](https://web3.okx.com/onchainos/dev-docs/okxai/registerasp)
3. [OKX.AI Marketplace](https://www.okx.ai/agents)
4. [OpenAI — GPT-5.4 nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano)
5. [OpenAI — GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)
6. [Google — Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
7. [OpenTelemetry — GenAI attributes](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)
8. [OpenTelemetry — GenAI metrics](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-metrics.md)
9. [Langfuse — Token and cost tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking)
10. [Portkey — Budget limits](https://portkey.ai/docs/product/ai-gateway/virtual-keys/budget-limits)
11. [OpenMeter documentation](https://openmeter.io/docs)
12. Catatan riset lokal `MARGN-VERIFIED.md`, snapshot 22 Juli 2026; file dan raw
    dataset belum menjadi bagian dari commit dokumen ini.
