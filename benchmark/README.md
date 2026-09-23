# DICOM performance benchmark

Performance comparison between [dcmtk-wasm](https://github.com/PantelisGeorgiadis/dcmtk-wasm),
[dicom-parser](https://github.com/cornerstonejs/dicom-parser) and
[dcmjs](https://github.com/dcmjs-org/dcmjs) for common DICOM Part 10 operations.

### What is measured

| Case        | dcmtk-wasm                                                      | dicom-parser                      | dcmjs                                      |
| ----------- | --------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| `parse`     | `parseDataset()`                                                | `parseDicom()`                    | `DicomMessage.readFile()`                  |
| `metadata`  | `parseDataset()` + `getMetadata()`                              | `parseDicom()` + read common tags | `readFile()` + `naturalizeDataset()`       |
| `pixelCopy` | `parseDataset()` + `getUncompressedFrame()` + copy              | `parseDicom()` + slice one frame  | `readFile()` + naturalize + copy PixelData |
| `decode`    | `parseDataset()` + `getUncompressedFrame()` (compressed inputs) | n/a                               | n/a                                        |

Notes:

- `pixelCopy`/`decode` are skipped for compressed transfer syntaxes where a
  library cannot produce uncompressed pixels (dicom-parser and dcmjs do not
  decode compressed pixel data by themselves), so `decode` only runs for
  dcmtk-wasm.
- `metadata` is not a like-for-like export: dcmtk-wasm returns the full
  dataset as JSON, dcmjs returns a fully naturalized JS object, and
  dicom-parser has no JSON export at all (a fixed set of common tags is read
  instead). Compare the numbers with that in mind.
- Each case runs warmup iterations first; mean/median/p95/stddev are reported
  per library, plus `rel` = median relative to the fastest library.

### Run

From the repository root (`npm install` first; `dicom-parser` and `dcmjs` are
devDependencies, dcmtk-wasm is loaded from `src/` + `wasm/bin/dcmtk-wasm.wasm`):

    npm run bench

Options:

    node benchmark/bench.js [options]
      --files <paths...>   DICOM Part 10 files to benchmark (default: synthetic
                           workloads: 512x512x16 1f implicit LE, 512x512x16 16f
                           explicit LE, 512x512x8 RGB 3f explicit LE, and a
                           small JPEG 2000 lossless file).
      --iters <n>          Timed iterations per case (default: 10).
      --warmup <n>         Warmup iterations per case (default: iters / 4).
      --json <path>        Also write results as JSON.
      --lib <name>         Only run one library: dcmtk | dicom-parser | dcmjs.

Example with real files:

    node benchmark/bench.js --files /path/to/study/*.dcm --iters 20 --json results.json

### Caveats

- Results are machine/load dependent; close other heavy applications and
  increase `--iters` for stable numbers.
- Node-only. In the browser, dcmtk-wasm additionally pays for wasm
  instantiation (not measured here); run the adapters in a page to measure that.
- Synthetic workloads are generated with `test/utils/p10Utils.js` using a fixed
  seed, so they are reproducible across runs and libraries.
