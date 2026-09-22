[![NPM version][npm-version-image]][npm-url] [![NPM downloads][npm-downloads-image]][npm-url] [![build][build-image]][build-url] [![MIT License][license-image]][license-url]

# dcmtk-wasm

DICOM dataset parsing and image rendering module based on WebAssembly and [DCMTK][dcmtk-url].

### Note

**This effort is a work-in-progress and should not be used for production or clinical purposes.**

### Features

- Parse DICOM Part 10 datasets in the browser or Node.js.
- Extract dataset metadata (all attributes except pixel data) as a JSON object.
- Render a frame to an BMP image.
- Decode a frame to its raw, uncompressed pixel data.
- Decode compressed pixel data via the bundled DCMTK codecs:
  - JPEG (baseline, extended, and lossless) via IJG libjpeg
  - JPEGLS via CharLS
  - RLE
  - JPEG 2000 via OpenJPEG
  - HTJ2K (High-Throughput JPEG 2000) via OpenJPH
  - Deflated Explicit VR Little Endian via zlib
- Reuse a single parsed dataset across multiple frame calls without re-parsing.

### Install

#### Node.js

    npm install dcmtk-wasm

#### Browser

    <script type="text/javascript" src="https://unpkg.com/dcmtk-wasm"></script>

### Build

    npm install
    npm run build

### Build native DCMTK WebAssembly (optional)

    cd wasm
    ./build.sh

[Emscripten SDK (emsdk)][emscripten-sdk-url] is required.

### Run the example application

    npm run start:examples:web

Serves the [rendering example][examples-url] (a Vue 3 app) on http://localhost:8080. Open a DICOM
Part 10 file, scroll through frames with the mouse wheel, and toggle the metadata panel.
Nothing is uploaded anywhere.

### Usage

#### Parsing a dataset and reading its metadata

```js
// Import objects in Node.js
const dcmtkWasm = require('dcmtk-wasm');
const { Dcmtk, DcmtkModule } = dcmtkWasm;

// Import objects in Browser
const { Dcmtk, DcmtkModule } = window.dcmtkWasm;

// Initialize the shared Dcmtk WebAssembly module. Call this once, before creating any Dcmtk instances.
await DcmtkModule.initializeAsync();

// Create a Dcmtk instance and parse an ArrayBuffer with the contents of the DICOM P10 byte stream.
const dcmtk = new Dcmtk();
try {
  dcmtk.parseDataset(arrayBuffer);

  // Get the dataset metadata (attributes other than pixel data) as a JSON object.
  const metadata = dcmtk.getMetadata();
} finally {
  // Release the underlying native context once done with this dataset.
  dcmtk.release();
}
```

#### Rendering and decoding frames

The parsed dataset is kept alive on the Dcmtk instance, so it can be reused for
multiple frame calls without re-parsing the source buffer.

```js
// Create a Dcmtk instance and parse an ArrayBuffer with the contents of the DICOM P10 byte stream.
const dcmtk = new Dcmtk();
try {
  dcmtk.parseDataset(arrayBuffer);

  // Render a frame to a BMP image. pixelData contains a full BMP file.
  const renderedFrame = dcmtk.getRenderedFrame(0);

  // Decode a frame to its uncompressed pixel data. pixelData contains raw uncompressed pixels.
  const uncompressedFrame = dcmtk.getUncompressedFrame(0);
} finally {
  dcmtk.release();
}
```

#### Frame object

Both `getRenderedFrame` and `getUncompressedFrame` return a frame object:

| Property                    | Type       | Description                                                                                    |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| `frameIndex`                | number     | Zero-based index of the frame.                                                                 |
| `columns`                   | number     | Number of columns (width).                                                                     |
| `rows`                      | number     | Number of rows (height).                                                                       |
| `bitsAllocated`             | number     | Bits allocated per sample.                                                                     |
| `bitsStored`                | number     | Bits stored per sample.                                                                        |
| `samplesPerPixel`           | number     | Samples per pixel (1 for grayscale, 3 for RGB/YBR).                                            |
| `pixelRepresentation`       | number     | 0 for unsigned, 1 for signed.                                                                  |
| `planarConfiguration`       | number     | 0 for interleaved, 1 for planar.                                                               |
| `photometricInterpretation` | string     | e.g. `MONOCHROME2`, `RGB`, `YBR_RCT`.                                                          |
| `pixelData`                 | Uint8Array | A full BMP file for `getRenderedFrame`, or raw uncompressed pixels for `getUncompressedFrame`. |

#### Advanced module initialization

```js
// Create Dcmtk WebAssembly initialization options.
const initOpts = {
  // Optionally, provide the path or URL to the WebAssembly module.
  // If empty or undefined, the module is trying to be resolved
  // within the same directory.
  webAssemblyModulePathOrUrl: undefined,
  // Optional flag to enable informational message logging.
  // If not provided, informational message logging is disabled.
  logMessages: false,
};
await DcmtkModule.initializeAsync(initOpts);
```

#### Module lifecycle

```js
// Check whether the shared module has been initialized.
DcmtkModule.isInitialized();

// Release the shared WebAssembly module and free its memory.
// Call this once, after all Dcmtk instances have been released.
DcmtkModule.release();
```

The package also exports a `log` (a [loglevel][loglevel-url] instance) and a `version` string.

### Related libraries

- [dcmjs-dimse][dcmjs-dimse-url] - DICOM DIMSE implementation for Node.js using dcmjs.
- [dcmjs-imaging][dcmjs-imaging-url] - DICOM image and overlay rendering for Node.js and browser using dcmjs.
- [dcmjs-codecs][dcmjs-codecs-url] - DICOM file and dataset transcoding for Node.js and browser using dcmjs.

### License

dcmtk-wasm is released under the MIT License.

[npm-url]: https://npmjs.org/package/dcmtk-wasm
[npm-version-image]: https://img.shields.io/npm/v/dcmtk-wasm.svg?style=flat
[npm-downloads-image]: http://img.shields.io/npm/dm/dcmtk-wasm.svg?style=flat
[build-url]: https://github.com/PantelisGeorgiadis/dcmtk-wasm/actions/workflows/build.yml
[build-image]: https://github.com/PantelisGeorgiadis/dcmtk-wasm/actions/workflows/build.yml/badge.svg?branch=main
[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: LICENSE.txt
[dcmtk-url]: https://dicom.offis.de/dcmtk.php.en
[dcmjs-dimse-url]: https://github.com/PantelisGeorgiadis/dcmjs-dimse
[dcmjs-imaging-url]: https://github.com/PantelisGeorgiadis/dcmjs-imaging
[dcmjs-codecs-url]: https://github.com/PantelisGeorgiadis/dcmjs-codecs
[emscripten-sdk-url]: https://emscripten.org/docs/getting_started/downloads.html
[examples-url]: examples/index.html
[loglevel-url]: https://github.com/pimterry/loglevel
