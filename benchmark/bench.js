#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Performance comparison between dcmtk-wasm, dicom-parser and dcmjs for
 * common DICOM Part 10 operations:
 *
 *  - parse      : full Part 10 parse (meta header + dataset, no pixel decode).
 *  - metadata   : parse + extract the dataset metadata as a JS object.
 *  - pixel copy : parse + access the (uncompressed) PixelData element and
 *                 copy one frame out (dcmtk-wasm: getUncompressedFrame(),
 *                 dicom-parser: readUint16/8Array(), dcmjs: pixelData buffer).
 *
 * dicom-parser does not decode compressed pixel data, so pixel decoding
 * (getUncompressedFrame/getRenderedFrame) is only benchmarked for dcmtk-wasm
 * on compressed inputs, as an informational extra.
 *
 * Usage:
 *   node benchmark/bench.js [options]
 *     --files <paths...>   DICOM Part 10 files to benchmark (default: synthetic
 *                          workloads generated with test/utils/p10Utils.js).
 *     --iters <n>          Timed iterations per case (default: 10).
 *     --warmup <n>         Warmup iterations per case (default: iters / 4).
 *     --json <path>        Also write results as JSON.
 *     --lib <name>         Only run the given library (dcmtk|dicom-parser|dcmjs).
 *
 * Run from the repository root. dcmtk-wasm is loaded from src/ (the wasm
 * binary in wasm/bin/), the other two from node_modules.
 */

const fs = require('fs');
const path = require('path');

const dcmjs = require('dcmjs');
const dicomParser = require('dicom-parser');
const { Dcmtk, DcmtkModule } = require('../src');
const { createDicomPart10FromPixelData } = require('../test/utils/p10Utils');

const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

// Silence dcmjs warnings (e.g. "Invalid vr type ox - using OW") so they don't
// interleave with the benchmark tables. The warnings come from the
// "validation.dcmjs" child logger, which does not inherit later root-level
// changes, so silence it directly.
dcmjs.log.getLogger('validation.dcmjs').setLevel('silent');
dcmjs.log.setLevel('silent');

// Transfer syntaxes used by the synthetic workloads.
const TS = {
  implicitLE: '1.2.840.10008.1.2',
  explicitLE: '1.2.840.10008.1.2.1',
  jpeg2000: '1.2.840.10008.1.2.4.90',
};

// A handful of common tags used for the tag-walk metadata variant.
const SAMPLE_TAGS = [
  '00080016', // SOPClassUID
  '00080018', // SOPInstanceUID
  '00100010', // PatientName
  '00100020', // PatientID
  '0020000D', // StudyInstanceUID
  '0020000E', // SeriesInstanceUID
  '00200013', // InstanceNumber
  '00280002', // SamplesPerPixel
  '00280010', // Rows
  '00280011', // Columns
  '00280100', // BitsAllocated
  '00280103', // PixelRepresentation
];

/**
 * Deterministic pseudo-random generator (mulberry32) so synthetic pixel
 * data is reproducible across runs and libraries.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds the synthetic workloads. Each workload is a DICOM Part 10 buffer
 * with a realistic-ish header plus generated pixel data.
 */
function createSyntheticWorkloads() {
  const workloads = [];

  // 512x512 16-bit mono, 1 frame, Implicit VR LE (very common for CT/MR).
  {
    const cols = 512;
    const rows = 512;
    const rand = mulberry32(42);
    const pixels = new Uint16Array(cols * rows);
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = Math.floor(rand() * 4096);
    }
    workloads.push({
      name: 'synthetic-512x512x16-1f-implicitLE',
      transferSyntax: TS.implicitLE,
      compressed: false,
      buffer: createDicomPart10FromPixelData({
        pixelData: pixels.buffer,
        columns: cols,
        rows: rows,
        bitsAllocated: 16,
        bitsStored: 12,
        transferSyntaxUid: TS.implicitLE,
        extraElements: {
          PatientName: 'BENCH^SYNTHETIC',
          PatientID: 'BENCH-001',
          StudyInstanceUID: DicomMetaDictionary.uid(),
          SeriesInstanceUID: DicomMetaDictionary.uid(),
          InstanceNumber: '1',
        },
      }),
    });
  }

  // 512x512 16-bit mono, 16 frames, Explicit VR LE (multi-frame).
  {
    const cols = 512;
    const rows = 512;
    const frames = 16;
    const rand = mulberry32(1337);
    const pixels = new Uint16Array(cols * rows * frames);
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = Math.floor(rand() * 4096);
    }
    workloads.push({
      name: 'synthetic-512x512x16-16f-explicitLE',
      transferSyntax: TS.explicitLE,
      compressed: false,
      buffer: createDicomPart10FromPixelData({
        pixelData: pixels.buffer,
        columns: cols,
        rows: rows,
        bitsAllocated: 16,
        bitsStored: 12,
        numberOfFrames: frames,
        transferSyntaxUid: TS.explicitLE,
        extraElements: {
          PatientName: 'BENCH^SYNTHETIC',
          PatientID: 'BENCH-002',
          StudyInstanceUID: DicomMetaDictionary.uid(),
          SeriesInstanceUID: DicomMetaDictionary.uid(),
          InstanceNumber: '1',
        },
      }),
    });
  }

  // 512x512 8-bit RGB, 3 frames, Explicit VR LE (color/video capture).
  {
    const cols = 512;
    const rows = 512;
    const frames = 3;
    const rand = mulberry32(2024);
    const pixels = new Uint8Array(cols * rows * 3 * frames);
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] = Math.floor(rand() * 256);
    }
    workloads.push({
      name: 'synthetic-512x512x8rgb-3f-explicitLE',
      transferSyntax: TS.explicitLE,
      compressed: false,
      buffer: createDicomPart10FromPixelData({
        pixelData: pixels.buffer,
        columns: cols,
        rows: rows,
        bitsAllocated: 8,
        samplesPerPixel: 3,
        photometricInterpretation: 'RGB',
        numberOfFrames: frames,
        transferSyntaxUid: TS.explicitLE,
        extraElements: {
          PatientName: 'BENCH^SYNTHETIC',
          PatientID: 'BENCH-003',
          StudyInstanceUID: DicomMetaDictionary.uid(),
          SeriesInstanceUID: DicomMetaDictionary.uid(),
          InstanceNumber: '1',
        },
      }),
    });
  }

  // 3x3 8-bit mono, 1 frame, JPEG 2000 lossless. dcmtk-wasm ships an
  // OpenJPEG-based decoder; dicom-parser/dcmjs only expose the codestream,
  // so only dcmtk-wasm is measured for pixel decoding here. The codestream
  // is the valid fixture from test/Dcmtk.test.js.
  {
    // prettier-ignore
    const jpeg2000Codestream = Uint8Array.from([
      0xff, 0x4f, 0xff, 0x51, 0x00, 0x29, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x07, 0x01, 0x01, 0xff, 0x52, 0x00,
      0x0c, 0x00, 0x00, 0x00, 0x08, 0x00, 0x05, 0x04, 0x04, 0x00, 0x01, 0xff, 0x5c, 0x00, 0x13, 0x40,
      0x40, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50,
      0xff, 0x90, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x4f, 0x00, 0x01, 0xff, 0x93, 0xc7, 0xd2,
      0x04, 0x04, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
      0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
      0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xa3, 0xec, 0x02, 0x9f, 0x78, 0x10,
      0x02, 0x87, 0x06, 0x7f, 0x80, 0x80, 0x80, 0x80, 0x80, 0xc3, 0xe6, 0x04, 0x00, 0x01, 0xaf, 0xff,
      0xd9,
    ]);
    workloads.push({
      name: 'synthetic-3x3x8-1f-jpeg2000',
      transferSyntax: TS.jpeg2000,
      compressed: true,
      buffer: createDicomPart10FromPixelData({
        pixelData: jpeg2000Codestream.buffer,
        columns: 3,
        rows: 3,
        transferSyntaxUid: TS.jpeg2000,
        extraElements: {
          PatientName: 'BENCH^SYNTHETIC',
          PatientID: 'BENCH-004',
          StudyInstanceUID: DicomMetaDictionary.uid(),
          SeriesInstanceUID: DicomMetaDictionary.uid(),
          InstanceNumber: '1',
        },
      }),
    });
  }

  return workloads;
}

function loadWorkloads(filePaths) {
  return filePaths.map((filePath) => {
    // NOTE: Buffer#buffer is Node's shared 8 KiB pool for small files, so
    // slice out the exact view instead of handing the pooled ArrayBuffer over.
    const fileBuffer = fs.readFileSync(filePath);
    const buffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );
    // Read the transfer syntax from the file itself.
    let transferSyntax = 'unknown';
    let compressed = false;
    try {
      const state = dicomParser.parseDicom(new Uint8Array(buffer), { untilTag: '00020010' });
      transferSyntax = state.string('x00020010') || 'unknown';
      compressed =
        transferSyntax !== TS.implicitLE &&
        transferSyntax !== TS.explicitLE &&
        transferSyntax !== '1.2.840.10008.1.2.2';
    } catch (e) {
      // Keep 'unknown', still benchmark parsing.
    }
    return {
      name: path.basename(filePath),
      transferSyntax,
      compressed,
      buffer,
    };
  });
}

// ---------------------------------------------------------------------------
// High-resolution timing helpers
// ---------------------------------------------------------------------------

function hrms() {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1e6;
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((acc, v) => acc + v, 0) / n;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const p95 = sorted[Math.min(n - 1, Math.ceil(0.95 * n) - 1)];
  const variance = sorted.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n;
  return { mean, median, p95, std: Math.sqrt(variance), min: sorted[0], max: sorted[n - 1] };
}

function runMeasured(fn, iterations) {
  const samples = [];
  let checksum = 0;
  for (let i = 0; i < iterations; i++) {
    const t0 = hrms();
    checksum += fn(i) || 0;
    samples.push(hrms() - t0);
  }
  return { ...stats(samples), checksum };
}

// ---------------------------------------------------------------------------
// Library adapters. Each returns an object of async benchmark functions
// (name -> () => checksum) for a given workload, or omits unsupported ones.
// ---------------------------------------------------------------------------

async function createDcmtkWasmAdapter() {
  if (!DcmtkModule.isInitialized()) {
    await DcmtkModule.initializeAsync({
      webAssemblyModulePathOrUrl: path.resolve(__dirname, '..', 'wasm', 'bin', 'dcmtk-wasm.wasm'),
    });
  }
  return {
    parse(workload) {
      return async () => {
        const dcmtk = new Dcmtk();
        try {
          dcmtk.parseDataset(workload.buffer);
          return workload.buffer.byteLength;
        } finally {
          dcmtk.release();
        }
      };
    },
    metadata(workload) {
      return async () => {
        const dcmtk = new Dcmtk();
        try {
          dcmtk.parseDataset(workload.buffer);
          const metadata = dcmtk.getMetadata();
          return Object.keys(metadata).length;
        } finally {
          dcmtk.release();
        }
      };
    },
    pixelCopy(workload) {
      if (workload.compressed) {
        return undefined; // Not applicable: no uncompressed PixelData to copy.
      }
      return async () => {
        const dcmtk = new Dcmtk();
        try {
          dcmtk.parseDataset(workload.buffer);
          const frame = dcmtk.getUncompressedFrame(0);
          // Copy the frame out, like a viewer would into its render buffer.
          const copy = new Uint8Array(frame.pixelData);
          return copy.length;
        } finally {
          dcmtk.release();
        }
      };
    },
    decode(workload) {
      // Informational: parse + decode frame 0 (the only library of the three
      // that decodes compressed pixel data).
      return async () => {
        const dcmtk = new Dcmtk();
        try {
          dcmtk.parseDataset(workload.buffer);
          const frame = dcmtk.getUncompressedFrame(0);
          return frame.pixelData.length;
        } finally {
          dcmtk.release();
        }
      };
    },
  };
}

function createDicomParserAdapter() {
  return {
    parse(workload) {
      return async () => {
        const state = dicomParser.parseDicom(new Uint8Array(workload.buffer));
        return Object.keys(state.elements).length;
      };
    },
    metadata(workload) {
      return async () => {
        const state = dicomParser.parseDicom(new Uint8Array(workload.buffer));
        // dicom-parser has no JSON export; walk a fixed set of common tags.
        let count = 0;
        for (const tag of SAMPLE_TAGS) {
          if (state.elements[tag]) {
            state.string(tag);
            count++;
          }
        }
        return count;
      };
    },
    pixelCopy(workload) {
      if (workload.compressed) {
        return undefined;
      }
      return async () => {
        const state = dicomParser.parseDicom(new Uint8Array(workload.buffer));
        const bitsAllocated = state.uint16('x00280100') || 8;
        const element = state.elements['x7fe00010'];
        // Copy one frame's worth of samples out of the PixelData element, the
        // way a viewer would into its render buffer.
        const bytesPerFrame =
          (state.uint32('x00280011') *
            state.uint32('x00280010') *
            (state.uint16('x00280002') || 1) *
            bitsAllocated) /
          8;
        const length = Math.min(bytesPerFrame, element.length);
        const copy = state.byteArray.slice(element.dataOffset, element.dataOffset + length);
        return copy.length;
      };
    },
  };
}

function createDcmjsAdapter() {
  const parse = (workload) =>
    DicomMessage.readFile(new Uint8Array(workload.buffer), { noCopy: true });
  return {
    parse(workload) {
      return async () => {
        const dict = parse(workload);
        return Object.keys(dict.dict).length;
      };
    },
    metadata(workload) {
      return async () => {
        const dict = parse(workload);
        const naturalized = DicomMetaDictionary.naturalizeDataset(dict.dict);
        return Object.keys(naturalized).length;
      };
    },
    pixelCopy(workload) {
      if (workload.compressed) {
        return undefined;
      }
      return async () => {
        const dict = parse(workload);
        const naturalized = DicomMetaDictionary.naturalizeDataset(dict.dict);
        const pixelData = naturalized.PixelData;
        const bytes = pixelData instanceof Uint8Array ? pixelData : new Uint8Array(pixelData);
        const copy = new Uint8Array(bytes);
        return copy.length;
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Runner + reporting
// ---------------------------------------------------------------------------

function pad(str, width, right = false) {
  const s = String(str);
  return right ? s.padEnd(width) : s.padStart(width);
}

function fmt(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(3)} s` : `${ms.toFixed(2)} ms`;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--files') {
      args.files = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args.files.push(argv[++i]);
      }
    } else if (['--iters', '--warmup', '--json', '--lib'].includes(argv[i])) {
      args[argv[i].slice(2)] = argv[++i];
    } else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  const iterations = parseInt(args.iters || '10', 10);
  const warmup = parseInt(args.warmup || String(Math.max(1, Math.floor(iterations / 4))), 10);
  const onlyLib = args.lib;

  const workloads = args.files ? loadWorkloads(args.files) : createSyntheticWorkloads();

  const libs = [];
  if (!onlyLib || onlyLib === 'dcmtk') {
    libs.push({ name: 'dcmtk-wasm', adapter: await createDcmtkWasmAdapter() });
  }
  if (!onlyLib || onlyLib === 'dicom-parser') {
    libs.push({ name: 'dicom-parser', adapter: createDicomParserAdapter() });
  }
  if (!onlyLib || onlyLib === 'dcmjs') {
    libs.push({ name: 'dcmjs', adapter: createDcmjsAdapter() });
  }

  const caseNames = ['parse', 'metadata', 'pixelCopy', 'decode'];
  const results = [];

  console.log('dcmtk-wasm vs dicom-parser vs dcmjs — DICOM performance benchmark');
  console.log(`Node ${process.version} | ${require('../package.json').name} from src/`);
  console.log(`iterations=${iterations} warmup=${warmup} (median ± std dev shown)`);
  console.log('');

  for (const workload of workloads) {
    console.log(
      `=== ${workload.name} (${(workload.buffer.byteLength / 1024).toFixed(0)} KiB, ` +
        `TS ${workload.transferSyntax}) ===`
    );
    for (const caseName of caseNames) {
      const rows = [];
      for (const lib of libs) {
        // decode is only reported for dcmtk-wasm on compressed inputs.
        if (caseName === 'decode' && (lib.name !== 'dcmtk-wasm' || !workload.compressed)) {
          continue;
        }
        const makeFn = lib.adapter[caseName];
        if (!makeFn) {
          continue;
        }
        const fn = makeFn(workload);
        if (!fn) {
          continue;
        }
        let s;
        try {
          for (let i = 0; i < warmup; i++) {
            await fn();
          }
          s = await runMeasured(fn, iterations);
        } catch (err) {
          // dicom-parser throws bare strings in places.
          const message = (err && err.message) || String(err);
          console.log(`  ${pad(caseName, 10)} ${pad(lib.name, 15, true)} SKIPPED: ${message}`);
          continue;
        }
        rows.push({ lib: lib.name, ...s });
      }
      if (!rows.length) {
        continue;
      }
      const best = Math.min(...rows.map((r) => r.median));
      const header =
        `  ${pad(caseName, 10)} ${pad('library', 15, true)} ` +
        `${pad('mean', 10, true)} ${pad('median', 10, true)} ${pad('p95', 10, true)} ` +
        `${pad('stddev', 9, true)} ${pad('rel', 8, true)}`;
      console.log(header);
      for (const r of rows) {
        const rel = `${(r.median / best).toFixed(2)}x`;
        console.log(
          `  ${pad(caseName, 10)} ${pad(r.lib, 15, true)} ${pad(fmt(r.mean), 10, true)} ` +
            `${pad(fmt(r.median), 10, true)} ${pad(fmt(r.p95), 10, true)} ` +
            `${pad(r.std.toFixed(2) + ' ms', 9, true)} ${pad(rel, 8, true)}`
        );
        results.push({
          workload: workload.name,
          transferSyntax: workload.transferSyntax,
          bytes: workload.buffer.byteLength,
          case: caseName,
          library: r.lib,
          meanMs: r.mean,
          medianMs: r.median,
          p95Ms: r.p95,
          stdMs: r.std,
          relativeToBest: r.median / best,
        });
      }
    }
    console.log('');
  }

  if (args.json) {
    fs.writeFileSync(
      path.resolve(args.json),
      JSON.stringify(
        { generatedAt: new Date().toISOString(), node: process.version, results },
        null,
        2
      )
    );
    console.log(`JSON results written to ${args.json}`);
  }

  // Clean up the shared wasm module so the process exits promptly.
  DcmtkModule.release();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
