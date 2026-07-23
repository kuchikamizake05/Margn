# marketplace-scan

Pengukuran OKX.AI marketplace untuk `Margn/MARGN-VERIFIED.md`. Semua angka di
dokumen itu berasal dari sini.

## Prasyarat

```bash
export PATH="$HOME/.local/bin:$PATH"
onchainos wallet status      # harus loggedIn: true
onchainos agent get-my-agents # butuh agent ber-peran User (kini #7520)
```

Kalau sesi kedaluwarsa: `onchainos wallet login` → selesaikan di browser →
`onchainos wallet login --phase poll`.

## Jalankan

```bash
S=$(date +%Y-%m-%dT%H%M)
python3 scan.py                        # ~3 mnt → agents-$S.json
python3 stats.py     | tee stats-$S.txt
python3 probe.py     | tee probe-$S.txt        # ~1 mnt
python3 matchtest.py | tee matchtest-$S.txt
```

**Nama file memuat jam, dan `scan.py` menolak menimpa file yang sudah ada.**
Pasar bergerak puluhan transaksi per menit; dua run di hari yang sama
menghasilkan angka berbeda, dan yang lama harus tetap ada supaya angka yang
sudah terlanjur dikutip di dokumen masih bisa dibuktikan.

`stats.py` / `probe.py` otomatis memakai `agents-*.json` terbaru; berikan path
sebagai argumen untuk membandingkan tanggal lain.

Ganti agent pembeli: `MARGN_AGENT_ID=1234 python3 matchtest.py`.
Perbesar sampel probe: `PROBE_SAMPLE=600 python3 probe.py`.

## Jalankan ulang kapan

Pasar bergerak ~2.000 transaksi/hari. **Ukur ulang di hari perekaman demo dan
hari submission** — peringkat `asp-match` bergeser harian (lihat §1 dokumen).

## Yang perlu diketahui

- **`QUERIES` di `scan.py` dibekukan.** Mengubahnya memutus keterbandingan antar
  tanggal. Kalau harus diubah, catat di dokumen.
- **`probe.py` memakai GET.** Sebagian endpoint POST-only, jadi 404/405
  melebih-lebihkan kerusakan. Angka `402` adalah **batas bawah** kesehatan —
  jangan sajikan sebagai vonis.
- **`asp-match` gagal deterministik pada sebagian frasa** dengan
  `code=4001` (mis. `"token price data"` gagal, `"token price"` jalan).
  `matchtest.py` melewati kebutuhan itu dan tetap lanjut.
- `matchtest.py` diakhiri `assert` — kalau tidak ada kegagalan ranking yang
  ditemukan, ia gagal dengan keras. Itu disengaja: klaim inti Margn tidak boleh
  lolos diam-diam kalau ternyata sudah tidak benar.
