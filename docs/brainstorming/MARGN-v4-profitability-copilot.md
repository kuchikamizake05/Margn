# Ide 4: Margn — Profitability Copilot for OKX.AI ASPs

> **Before an ASP sets an x402 price, Margn tells it whether that price actually makes money.**

## 1. Ringkasan

Margn adalah Finance Copilot untuk penjual jasa AI di OKX.AI. Margn menerima data
penggunaan sebuah service call, menghitung seluruh biaya yang tersembunyi di balik
call tersebut, lalu merekomendasikan harga minimum sesuai target gross margin ASP.

Margn tidak memberikan rekomendasi investasi dan tidak mengelola aset pengguna.
Fokusnya adalah unit economics bisnis ASP: biaya, harga, dan profitabilitas.

## 2. Masalah

Pendapatan A2MCP terlihat jelas karena harga ditetapkan per call dan pembayaran
diselesaikan melalui x402. Biaya riil di balik call jauh lebih sulit terlihat:

- input dan output token LLM;
- cached token dan model pricing;
- tool atau API berbayar;
- retry setelah error atau timeout;
- call gagal setelah compute terpakai;
- biaya infrastruktur tetap atau per request.

Akibatnya, ASP dapat memiliki revenue dan jumlah order yang meningkat sambil tetap
rugi pada setiap call.

## 3. Pengguna utama

Developer atau operator ASP yang:

- menjual service A2MCP dengan harga tetap per call;
- memakai LLM atau API berbayar di belakang endpoint;
- belum mengetahui gross margin per service;
- ingin menetapkan harga berdasarkan biaya nyata, bukan tebakan.

## 4. Value proposition

Margn menjawab empat pertanyaan:

1. Berapa biaya nyata satu service call?
2. Apakah harga saat ini menghasilkan profit atau loss?
3. Berapa harga minimum untuk mencapai target margin?
4. Apakah harga tersebut masih masuk akal dibandingkan marketplace?

## 5. Produk MVP

### `calculate_cost`

Menghitung biaya aktual sebuah call dari usage dan biaya tambahan.

Contoh input:

```json
{
  "model": "example-model",
  "input_tokens": 5000,
  "output_tokens": 1200,
  "cached_tokens": 0,
  "tool_cost_usd": 0.001,
  "retry_count": 1,
  "infrastructure_cost_usd": 0.0002,
  "outcome": "ok"
}
```

Contoh output:

```json
{
  "llm_cost_usd": 0.0024,
  "tool_cost_usd": 0.001,
  "retry_cost_usd": 0.0012,
  "infrastructure_cost_usd": 0.0002,
  "total_cost_usd": 0.0048
}
```

### `recommend_price`

Menghasilkan price floor berdasarkan biaya dan target gross margin.

```text
price_floor = cost_per_call / (1 - target_margin)
```

Untuk biaya `$0.0048` dan target margin `30%`, price floor adalah sekitar
`$0.00686`.

### `simulate_price`

Membandingkan harga saat ini dan harga baru:

- profit/loss per call;
- gross margin;
- proyeksi profit pada volume tertentu;
- dampak retry dan failed calls.

### `benchmark_market`

Membandingkan price floor dengan distribusi harga service sejenis di marketplace.
Benchmark hanya menjadi konteks; rekomendasi utama tetap berasal dari struktur
biaya ASP sendiri.

## 6. User flow

```text
Pilih model atau kirim objek usage
                ↓
Tambahkan tool, retry, dan infrastructure cost
                ↓
Margn menghitung cost per call
                ↓
Masukkan selling price dan target margin
                ↓
Margn menampilkan profit/loss dan price floor
                ↓
Bandingkan dengan marketplace benchmark
```

MVP menyediakan dua surface:

- **Web calculator** agar manusia dan juri dapat mencoba tanpa instalasi.
- **A2MCP endpoint** agar ASP atau agent lain dapat memanggil Margn secara
  programatis.

## 7. Positioning terhadap Tender

Tender dan Margn berada di sisi pasar yang berbeda:

| Produk | Pengguna | Tugas utama |
| --- | --- | --- |
| Tender | Agent pembeli | Membeli dari beberapa ASP dan memilih value terbaik |
| Margn | ASP penjual | Menghitung biaya dan menetapkan harga yang profitable |

Positioning singkat:

> **Tender helps agents buy better. Margn helps ASPs price profitably.**

## 8. Demo 90 detik

1. Sebuah ASP menjual service seharga `$0.003` per call.
2. Kirim usage nyata dari satu call ke Margn.
3. Margn menghitung biaya aktual `$0.0048`.
4. Tampilkan: `You lose $0.0018 per call`.
5. Pilih target margin `30%`.
6. Margn merekomendasikan price floor `$0.00686`.
7. Simulasikan dampaknya pada 10.000 call.
8. Tampilkan benchmark marketplace dan satu paid x402 call ke Margn.
9. Tutup dengan Margn mengaudit unit economics miliknya sendiri.

## 9. Hackathon positioning

### Target utama: Finance Copilot

Margn adalah copilot keuangan operasional untuk bisnis agent. Ia menghitung biaya,
gross margin, dan pricing tanpa memberikan investment advice.

### Target tambahan

- **Creative Genius:** meta-service yang membantu ASP lain menjadi bisnis sehat.
- **Best Product:** jika calculator, A2MCP service, dan demo membentuk pengalaman
  end-to-end yang rapi.
- **Revenue Rocket:** hanya relevan jika Margn benar-benar memperoleh qualified
  orders, revenue, dan positive reviews selama periode kompetisi.

## 10. Out of scope untuk MVP

- wallet atau counterparty scoring;
- dispute prediction;
- auto bidding dan task negotiation;
- otomatis mengubah harga ASP;
- menarik claimable rewards;
- cross-account reconciliation;
- portfolio diversification;
- buyer-side ASP routing.

Fitur tersebut dapat menjadi roadmap, tetapi tidak boleh mengaburkan hero feature:
**price floor berdasarkan biaya nyata.**

## 11. Risiko dan mitigasi

| Risiko | Mitigasi MVP |
| --- | --- |
| ASP belum punya telemetry | Sediakan input manual dan terima objek `usage` standar |
| Model pricing berubah | Simpan pricing bertanggal dan tampilkan timestamp sumber |
| Benchmark kategori tidak akurat | Tampilkan sample size dan jangan gunakan benchmark sebagai sumber price floor |
| Dianggap hanya calculator | Sediakan A2MCP integration, history, simulasi, dan self-audit nyata |
| Data biaya tidak lengkap | Tampilkan confidence dan daftar biaya yang belum diberikan |

## 12. Definition of done

MVP dinyatakan siap ketika:

- web calculator dapat digunakan publik;
- empat fungsi inti menghasilkan output deterministik dan dapat dijelaskan;
- endpoint menggunakan HTTPS dan lolos health check;
- A2MCP ASP terdaftar dan live di OKX.AI;
- free atau paid x402 flow bekerja end-to-end;
- sekurangnya satu analisis memakai usage nyata, bukan mock;
- formula pricing memiliki automated tests;
- demo maksimal 90 detik dapat direproduksi.
