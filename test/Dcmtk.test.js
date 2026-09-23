const Dcmtk = require('./../src/Dcmtk');
const DcmtkModule = require('./../src/DcmtkModule');
const {
  createDicomPart10FromPixelData,
  createDeflatedPart10FromPixelData,
} = require('./utils/p10Utils');

const fs = require('fs');
const path = require('path');
const chai = require('chai');
const sinon = require('sinon');
const expect = chai.expect;

async function loadWasmResponse() {
  const isNodeJs = !!(typeof process !== 'undefined' && process.versions && process.versions.node);
  if (isNodeJs) {
    const buffer = fs.readFileSync(path.join(process.cwd(), 'wasm/bin/dcmtk-wasm.wasm'));
    return new Response(buffer, { headers: { 'content-type': 'application/wasm' } });
  }
  // Karma tests
  const response = await fetch('base/wasm/bin/dcmtk-wasm.wasm');
  return new Response(await response.arrayBuffer(), {
    headers: { 'content-type': 'application/wasm' },
  });
}

describe('Uninitialized DcmtkModule', () => {
  it('should throw for uninitialized DcmtkModule', () => {
    expect(() => {
      new Dcmtk();
    }).to.throw();
  });
});

describe('Dcmtk', () => {
  before(async () => {
    sinon.stub(DcmtkModule, '_getWebAssemblyResponse').callsFake(loadWasmResponse);
    await DcmtkModule.initializeAsync({ logMessages: true });
  });

  after(() => {
    sinon.restore();
  });

  it('should correctly decode the metadata of a dynamically generated dataset', () => {
    const width = 8;
    const height = 8;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
      extraElements: { PatientName: 'Test^Patient', PatientID: 'TEST01' },
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const metadata = dcmtk.getMetadata();
      expect(metadata['00280010'].Value[0]).to.equal(height);
      expect(metadata['00280011'].Value[0]).to.equal(width);
      expect(metadata['00280100'].Value[0]).to.equal(8);
      expect(metadata['00280101'].Value[0]).to.equal(8);
      expect(metadata['00280002'].Value[0]).to.equal(1);
      expect(metadata['00280004'].Value[0]).to.equal('MONOCHROME2');
      expect(metadata['00100010'].Value[0].Alphabetic).to.equal('Test^Patient');
      expect(metadata['00100020'].Value[0]).to.equal('TEST01');
      // Pixel data should not leak into the metadata.
      expect(metadata['7FE00010']).to.be.undefined;
    } finally {
      dcmtk.release();
    }
  });
  it('should correctly decode the metadata of a dynamically generated dataset without pixel data', () => {
    const width = 8;
    const height = 8;

    const part10 = createDicomPart10FromPixelData({
      columns: width,
      rows: height,
      extraElements: { PatientName: 'Test^Patient', PatientID: 'TEST01' },
      omitPixelData: true,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const metadata = dcmtk.getMetadata();
      expect(metadata['00280010'].Value[0]).to.equal(height);
      expect(metadata['00280011'].Value[0]).to.equal(width);
      expect(metadata['00280100'].Value[0]).to.equal(8);
      expect(metadata['00280101'].Value[0]).to.equal(8);
      expect(metadata['00280002'].Value[0]).to.equal(1);
      expect(metadata['00280004'].Value[0]).to.equal('MONOCHROME2');
      expect(metadata['00100010'].Value[0].Alphabetic).to.equal('Test^Patient');
      expect(metadata['00100020'].Value[0]).to.equal('TEST01');
      // A dataset without a PixelData element must not surface one in the
      // metadata, and must not throw during JSON serialization.
      expect(metadata['7FE00010']).to.be.undefined;
    } finally {
      dcmtk.release();
    }
  });
  it('should correctly round-trip an 8-bit grayscale frame (uncompressed)', () => {
    const width = 4;
    const height = 4;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i * 16);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
      bitsAllocated: 8,
      bitsStored: 8,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.frameIndex).to.equal(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(frame.bitsAllocated).to.equal(8);
      expect(frame.bitsStored).to.equal(8);
      expect(frame.samplesPerPixel).to.equal(1);
      expect(frame.pixelRepresentation).to.equal(0);
      expect(frame.photometricInterpretation).to.equal('MONOCHROME2');
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(pixels.buffer));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly round-trip a 16-bit grayscale frame (uncompressed)', () => {
    const width = 4;
    const height = 4;
    const pixels = Uint16Array.from({ length: width * height }, (_, i) => i * 273);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
      bitsAllocated: 16,
      bitsStored: 12,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.bitsAllocated).to.equal(16);
      expect(frame.bitsStored).to.equal(12);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(pixels.buffer));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly round-trip an RGB color frame (uncompressed)', () => {
    const width = 4;
    const height = 4;
    const pixels = Uint8Array.from({ length: width * height * 3 }, (_, i) => (i * 7) % 256);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
      samplesPerPixel: 3,
      photometricInterpretation: 'RGB',
      planarConfiguration: 0,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.samplesPerPixel).to.equal(3);
      expect(frame.planarConfiguration).to.equal(0);
      expect(frame.photometricInterpretation).to.equal('RGB');
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(pixels.buffer));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly round-trip a deflated RGB color frame', () => {
    const width = 3;
    const height = 3;
    // prettier-ignore
    const pixels = Uint8Array.from([
       0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
       0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
       0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00,
     ]);

    const part10 = createDeflatedPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
      samplesPerPixel: 3,
      photometricInterpretation: 'RGB',
      planarConfiguration: 0,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.samplesPerPixel).to.equal(3);
      expect(frame.planarConfiguration).to.equal(0);
      expect(frame.photometricInterpretation).to.equal('RGB');
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(pixels.buffer));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly decode an encapsulated RLE Lossless frame', () => {
    const width = 3;
    const height = 3;
    // prettier-ignore
    const expectedImageData = Uint8Array.from([
      0x00, 0xff, 0x00,
      0xff, 0x00, 0xff,
      0x00, 0xff, 0x00,
    ]);
    // prettier-ignore
    const rleData = Uint8Array.from([
      // Number of segments
      0x01, 0x00, 0x00, 0x00,
      // First segment offset
      0x40, 0x00, 0x00, 0x00,
      // Other segment offsets
      0x00, 0x00, 0x00, 0x00, // 2
      0x00, 0x00, 0x00, 0x00, // 3
      0x00, 0x00, 0x00, 0x00, // 4
      0x00, 0x00, 0x00, 0x00, // 5
      0x00, 0x00, 0x00, 0x00, // 6
      0x00, 0x00, 0x00, 0x00, // 7
      0x00, 0x00, 0x00, 0x00, // 8
      0x00, 0x00, 0x00, 0x00, // 9
      0x00, 0x00, 0x00, 0x00, // 10
      0x00, 0x00, 0x00, 0x00, // 11
      0x00, 0x00, 0x00, 0x00, // 12
      0x00, 0x00, 0x00, 0x00, // 13
      0x00, 0x00, 0x00, 0x00, // 14
      0x00, 0x00, 0x00, 0x00, // 15
      // RLE data
      0x08, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00,
    ]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: rleData.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.5', // RLE Lossless
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(expectedImageData));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly decode an encapsulated JPEG Baseline frame', () => {
    const width = 3;
    const height = 3;
    // prettier-ignore
    const expectedImageData = Uint8Array.from([
      0x00, 0xff, 0x00,
      0xff, 0x00, 0xff,
      0x00, 0xff, 0x00,
    ]);
    // prettier-ignore
    const jpegBaselineCodestream = Uint8Array.from([
      // Start of image (SOI) marker
      0xff, 0xd8,
      // Application segment 0 (APP0) marker
      0xff, 0xe0,
      // APP0 marker length
      0x00, 0x10,
      // Identifier string JFIF
      0x4a, 0x46, 0x49, 0x46, 0x00,
      // JFIF version 1.01
      0x01, 0x01,
      // Density units (no units = 0)
      0x00,
      // Horizontal density
      0x00, 0x01,
      // Vertical density
      0x00, 0x01,
      // X thumbnail size
      0x00,
      // Y thumbnail size
      0x00,
      // Define quantization table (DQT) marker
      0xff, 0xdb,
      // DQT marker length
      0x00, 0x43,
      // Table #0, 8-bit
      0x00,
      // 64 byte quantization table
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01,
      0x01, 0x01, 0x01, 0x01,
      // Start of frame 0 (SOF0) marker
      0xff, 0xc0,
      // SOF0 marker length
      0x00, 0x0b,
      // Bits per pixel
      0x08,
      // Image height
      0x00, 0x03,
      // Image width
      0x00, 0x03,
      // Number of components
      0x01,
      // Y component ID, sampling factor (H1 = 1, V1 = 1), quantization table number
      0x01, 0x11, 0x00,
      // Define huffman table (DHT) marker
      0xff, 0xc4,
      // DHT marker length
      0x00, 0x1a,
      // Huffman table
      0x10,
      // Table data
      0x00, 0x03, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x05, 0x06, 0x07, 0x08, 0x04, 0x09, 0x03,
      // Define huffman table (DHT) marker
      0xff, 0xc4,
      // DHT marker length
      0x00, 0x14,
      // Table data
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x0a,
      // Start of scan (SOS) marker
      0xff, 0xda,
      // SOS marker length
      0x00, 0x08,
      // Number of components
      0x01,
      // Y component ID, huffman table to use
      0x01, 0x00,
      // Start of spectral selection or predictor selection
      0x00,
      // End of spectral selection
      0x3f,
      // Successive approximation bit position or point transform
      0x00,
      // Frame data
      0x37, 0xbb, 0x87, 0x70, 0xda, 0x24, 0xf6, 0x84, 0xa5, 0x65, 0x64, 0xac, 0x80, 0x54, 0x61,
      0x5c, 0x81, 0xe7, 0xb5, 0x2f, 0xab, 0xaa, 0x97, 0xe7, 0xb6, 0x05, 0xb4, 0x31, 0xfc, 0x98,
      0xed, 0x18, 0x17, 0x34, 0xd8, 0x9c, 0x06, 0x8d, 0x70, 0xb1, 0x66, 0x97, 0xb6, 0xd0, 0xf3,
      0xf0, 0xed, 0xaf, 0x66, 0xc4, 0x49, 0xe4, 0xe2, 0x0d, 0xf0, 0xcb, 0x20, 0x92, 0xce, 0x14,
      0xd8, 0x5c, 0x2d, 0x36, 0x73, 0x12, 0x9d, 0x4f, 0xa7, 0xab, 0x1f,
      // End of image (EOI) marker
      0xff, 0xd9,
    ]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: jpegBaselineCodestream.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.50', // JPEG Baseline Process 1
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(expectedImageData));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly decode an encapsulated JPEG-LS Lossless frame', () => {
    const width = 3;
    const height = 3;
    // prettier-ignore
    const expectedImageData = Uint8Array.from([
      0x00, 0xff, 0x00,
      0xff, 0x7f, 0xff,
      0x00, 0xff, 0x00,
    ]);
    // prettier-ignore
    const jpegLsCodestream = Uint8Array.from([
      // Start of image (SOI) marker
      0xff, 0xd8,
      // Start of JPEG-LS frame (SOF55) marker
      0xff, 0xf7,
      // Length of marker segment
      0x00, 0x0b,
      // P = Precision
      0x08,
      // Y = Number of lines (big endian)
      0x00, 0x03,
      // X = Number of columns (big endian)
      0x00, 0x03,
      // Nf = Number of components in the frame
      0x01,
      // C1 = Component ID
      0x01,
      // Sub-sampling: H1 = 1, V1 = 1
      0x11,
      // Tq1
      0x00,
      // Start of scan (SOS) marker
      0xff, 0xda,
      // Length of marker segment
      0x00, 0x08,
      // Ns = Number of components for this scan
      0x01,
      // Ci = Component ID
      0x01,
      // Tm1 = Mapping table index (no mapping table)
      0x00,
      // NEAR (0 = Lossless)
      0x00,
      // ILV = 0 (non-interleaved)
      0x00,
      // Al = 0, Ah = 0 (no point transform)
      0x00,
      // Frame data
      0xa5, 0xa0, 0x00, 0x00, 0x3f, 0xda, 0x06, 0x0e,
      // End of image (EOI) marker
      0xff, 0xd9,
    ]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: jpegLsCodestream.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.80', // JPEG-LS Lossless
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(expectedImageData));
    } finally {
      dcmtk.release();
    }
  });
  it('should correctly decode an encapsulated JPEG 2000 Lossless frame', () => {
    const width = 3;
    const height = 3;
    // prettier-ignore
    const expectedImageData = Uint8Array.from([
       0x00, 0xff, 0x00,
       0xff, 0x7f, 0xff,
       0x00, 0xff, 0x00,
     ]);
    // prettier-ignore
    const jpeg2000Codestream = Uint8Array.from([
       // Start of codestream (SOC)
       0xff, 0x4f,
       // Image and tile size (SIZ)
       0xff, 0x51,
       // SIZ marker length
       0x00, 0x29,
       // Profile
       0x00, 0x00,
       // Reference grid size width
       0x00, 0x00, 0x00, 0x03,
       // Reference grid size height
       0x00, 0x00, 0x00, 0x03,
       // Horizontal offset from the origin of the reference
       // grid to the left and top side of the image area
       0x00, 0x00, 0x00, 0x00,
       // Vertical offset from the origin of the reference
       // grid to the left and top side of the image area
       0x00, 0x00, 0x00, 0x00,
       // Reference tile width
       0x00, 0x00, 0x00, 0x03,
       // Reference tile height
       0x00, 0x00, 0x00, 0x03,
       // Horizontal offset from the origin of the reference grid
       // to the left and top side of the first tile
       0x00, 0x00, 0x00, 0x00,
       // Vertical offset from the origin of the reference grid
       // to the left and top side of the first tile
       0x00, 0x00, 0x00, 0x00,
       // Number of color components
       0x00, 0x01,
       // Precision (depth) in bits and sign of the component samples
       0x07,
       // Horizontal separation of a sample
       0x01,
       // Vertical separation of a sample
       0x01,
       // Coding style default (COD)
       0xff, 0x52,
       // COD marker length
       0x00, 0x0c,
       // Coding style
       0x00,
       // Progression (LRCP = 0)
       0x00,
       // Quality layers
       0x00, 0x08,
       // Multiple component transform
       0x00,
       // Decomposition levels
       0x05,
       // Codeblock width exponent
       0x04,
       // Codeblock height exponent
       0x04,
       // Codeblock style
       0x00,
       // Wavelet filter (Irreversible_9_7 = 0, Reversible_5_3 = 1)
       0x01,
       // Quantization default (QCD)
       0xff, 0x5c,
       // QCD marker length
       0x00, 0x13,
       // Quantization default values for the Sqcd and Sqcc parameters
       0x40, 0x40, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48, 0x48, 0x50, 0x48,
       0x48, 0x50,
       // Start of tile (SOT)
       0xff, 0x90,
       // SOT marker length
       0x00, 0x0a,
       // Tile index
       0x00, 0x00,
       // Length, in bytes, from the beginning of the first byte of
       // this SOT marker segment of the tile-part to the end of the
       // data of that tile-part
       0x00, 0x00, 0x00, 0x4f,
       // Tile-part index
       0x00,
       // Number of tile-parts of a tile in the codestream
       0x01,
       // Start of data (SOD)
       0xff, 0x93,
       // Frame data
       0xc7, 0xd2, 0x04, 0x04, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
       0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
       0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0xa3,
       0xec, 0x02, 0x9f, 0x78, 0x10, 0x02, 0x87, 0x06, 0x7f, 0x80, 0x80, 0x80, 0x80, 0x80, 0xc3,
       0xe6, 0x04, 0x00, 0x01, 0xaf,
       // End of codestream (EOC)
       0xff, 0xd9,
     ]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: jpeg2000Codestream.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.90', // JPEG 2000 Lossless
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(expectedImageData));
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly decode an encapsulated HTJ2K Lossless frame', () => {
    const width = 4;
    const height = 4;
    // prettier-ignore
    const expectedImageData = Uint8Array.from([
       0x00, 0xff, 0x00, 0xff,
       0xff, 0x00, 0xff, 0x00,
       0x00, 0xff, 0x00, 0xff,
       0xff, 0x00, 0xff, 0x00,
     ]);
    // prettier-ignore
    // NOTE: unlike the other codec fixtures in this file (copied verbatim from
    // dcmjs-imaging's NativePixelDecoder.test.js), this codestream is NOT a
    // byte-for-byte copy of the upstream "HtJpeg2000Lossless" test vector.
    // That upstream fixture has a malformed QCD marker (subband quantization
    // exponents inconsistent with the actual entropy-coded bit-depth), which
    // a spec-compliant HTJ2K decoder (openjph, used by wasm/src/Codecs/DcmtkHtJpeg2000)
    // decodes into wildly incorrect pixel values; it only "works" upstream because
    // their test decodes it via a generic, non-HT JPEG2000 code path instead. This
    // codestream was generated with the project's own vendored openjph encoder
    // (same 4x4 checkerboard image/dimensions) and round-trips correctly through
    // both a native openjph decode and dcmtk-wasm's actual HTJ2K decoder.
    const htJpeg2000Codestream = Uint8Array.from([
       // Start of codestream (SOC)
       0xff, 0x4f,
       // Image and tile size (SIZ)
       0xff, 0x51,
       // SIZ marker length
       0x00, 0x29,
       // Profile
       0x40, 0x00,
       // Reference grid size width
       0x00, 0x00, 0x00, 0x04,
       // Reference grid size height
       0x00, 0x00, 0x00, 0x04,
       // Horizontal offset from the origin of the reference
       // grid to the left and top side of the image area
       0x00, 0x00, 0x00, 0x00,
       // Vertical offset from the origin of the reference
       // grid to the left and top side of the image area
       0x00, 0x00, 0x00, 0x00,
       // Reference tile width
       0x00, 0x00, 0x00, 0x04,
       // Reference tile height
       0x00, 0x00, 0x00, 0x04,
       // Horizontal offset from the origin of the reference grid
       // to the left and top side of the first tile
       0x00, 0x00, 0x00, 0x00,
       // Vertical offset from the origin of the reference grid
       // to the left and top side of the first tile
       0x00, 0x00, 0x00, 0x00,
       // Number of color components
       0x00, 0x01,
       // Precision (depth) in bits and sign of the component samples
       0x07,
       // Horizontal separation of a sample
       0x01,
       // Vertical separation of a sample
       0x01,
       // Extended capability (CAP)
       0xff, 0x50,
       // CAP marker length
       0x00, 0x08,
       // Capabilities (Pcap with bit 15 set to indicate HTJ2K usage)
       0x00, 0x02, 0x00, 0x00, 0x00, 0x02,
       // Coding style default (COD)
       0xff, 0x52,
       // COD marker length
       0x00, 0x0c,
       // Coding style
       0x00,
       // Progression (RPCL = 2)
       0x02,
       // Quality layers
       0x00, 0x01,
       // Multiple component transform
       0x00,
       // Decomposition levels
       0x05,
       // Codeblock width exponent
       0x04,
       // Codeblock height exponent
       0x04,
       // Codeblock style
       0x40,
       // Wavelet filter (Irreversible_9_7 = 0, Reversible_5_3 = 1)
       0x01,
       // Quantization default (QCD)
       0xff, 0x5c,
       // QCD marker length
       0x00, 0x13,
       // Quantization default values for the Sqcd and Sqcc parameters
       0x20, 0x48, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x50, 0x48,
       0x48, 0x48,
       // Start of tile (SOT)
       0xff, 0x90,
       // SOT marker length
       0x00, 0x0a,
       // Tile index
       0x00, 0x00,
       // Length, in bytes, from the beginning of the first byte of
       // this SOT marker segment of the tile-part to the end of the
       // data of that tile-part
       0x00, 0x00, 0x00, 0x1e,
       // Tile-part index
       0x00,
       // Number of tile-parts of a tile in the codestream
       0x01,
       // Start of data (SOD)
       0xff, 0x93,
       // Frame data
       0x00, 0x00, 0x00, 0x00, 0x00, 0x90, 0x0a, 0x80, 0xfb, 0xf7, 0xdf, 0x7f, 0x01, 0x01, 0xb4,
       0x00,
       // End of codestream (EOC)
       0xff, 0xd9,
     ]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: htJpeg2000Codestream.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.201', // HTJ2K Lossless
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getUncompressedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(Buffer.from(frame.pixelData)).to.deep.equal(Buffer.from(expectedImageData));
    } finally {
      dcmtk.release();
    }
  });

  it('should throw a descriptive error for an unsupported transfer syntax', () => {
    const width = 3;
    const height = 3;
    const fakeMpeg2Codestream = Uint8Array.from([0x00, 0x00, 0x01, 0xb3]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: fakeMpeg2Codestream.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.100', // MPEG2 Main Profile Main Level
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      expect(() => {
        dcmtk.getUncompressedFrame(0);
      }).to.throw(/Unsupported transfer syntax/);
      expect(() => {
        dcmtk.getRenderedFrame(0);
      }).to.throw(/Unsupported transfer syntax/);
    } finally {
      dcmtk.release();
    }
  });

  it('should correctly render a frame as a BMP image', () => {
    const width = 4;
    const height = 4;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i * 16);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      const frame = dcmtk.getRenderedFrame(0);
      expect(frame.columns).to.equal(width);
      expect(frame.rows).to.equal(height);
      expect(frame.bitsAllocated).to.equal(8);
      expect(frame.samplesPerPixel).to.equal(3);
      expect(frame.photometricInterpretation).to.equal('RGB');
      // BMP files start with the 'BM' magic bytes.
      expect(frame.pixelData[0]).to.equal('B'.charCodeAt(0));
      expect(frame.pixelData[1]).to.equal('M'.charCodeAt(0));
    } finally {
      dcmtk.release();
    }
  });

  it('should reuse the parsed dataset for metadata and frame calls on the same instance', () => {
    const width = 4;
    const height = 4;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i * 16);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      // Reading metadata should not prevent subsequent frame extraction calls
      // on the same, already parsed dataset.
      dcmtk.getMetadata();
      const renderedFrame = dcmtk.getRenderedFrame(0);
      const uncompressedFrame = dcmtk.getUncompressedFrame(0);
      const metadata = dcmtk.getMetadata();

      expect(renderedFrame.pixelData.length).to.be.greaterThan(0);
      expect(Buffer.from(uncompressedFrame.pixelData)).to.deep.equal(Buffer.from(pixels.buffer));
      expect(metadata['00280010'].Value[0]).to.equal(height);
    } finally {
      dcmtk.release();
    }
  });

  it('should throw when requesting an out-of-range frame index', () => {
    const width = 2;
    const height = 2;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      // Exceptions thrown natively across the wasm boundary don't carry a
      // usable message unless propagated through DcmtkModule._callWasm, so
      // assert on the actual message to guard against that regressing.
      expect(() => {
        dcmtk.getUncompressedFrame(1);
      }).to.throw(/FrameIndex out of range/);
      expect(() => {
        dcmtk.getRenderedFrame(1);
      }).to.throw(/FrameIndex out of range/);
      // The instance must remain usable after a caught exception.
      expect(dcmtk.getUncompressedFrame(0).frameIndex).to.equal(0);
    } finally {
      dcmtk.release();
    }
  });

  it('should throw a descriptive error for a corrupt encapsulated frame', () => {
    const width = 3;
    const height = 3;
    const corruptJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

    const part10 = createDicomPart10FromPixelData({
      pixelData: corruptJpeg.buffer,
      columns: width,
      rows: height,
      transferSyntaxUid: '1.2.840.10008.1.2.4.50', // JPEG Baseline
    });

    const dcmtk = new Dcmtk();
    try {
      dcmtk.parseDataset(part10);
      expect(() => {
        dcmtk.getUncompressedFrame(0);
      }).to.throw();
      // The instance must remain usable after a caught decode failure.
      expect(dcmtk.getMetadata()['00280010'].Value[0]).to.equal(height);
    } finally {
      dcmtk.release();
    }
  });

  it('should throw when using a released instance', () => {
    const width = 2;
    const height = 2;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    dcmtk.parseDataset(part10);
    dcmtk.release();
    // Releasing more than once should be a no-op.
    dcmtk.release();

    expect(() => {
      dcmtk.getMetadata();
    }).to.throw();
    expect(() => {
      dcmtk.getUncompressedFrame(0);
    }).to.throw();
    expect(() => {
      dcmtk.getRenderedFrame(0);
    }).to.throw();
  });

  it('should throw when the module is re-initialized under a live instance', async () => {
    const width = 2;
    const height = 2;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    dcmtk.parseDataset(part10);
    const generationBefore = DcmtkModule.generation;

    // Re-initializing the shared module replaces the wasm instance and heap, so
    // the native context of the live instance above becomes a dangling pointer.
    await DcmtkModule.initializeAsync({ logMessages: false });
    expect(DcmtkModule.generation).to.equal(generationBefore + 1);

    expect(() => {
      dcmtk.parseDataset(part10);
    }).to.throw(/stale/);
    expect(() => {
      dcmtk.getMetadata();
    }).to.throw(/stale/);
    expect(() => {
      dcmtk.getUncompressedFrame(0);
    }).to.throw(/stale/);
    expect(() => {
      dcmtk.getRenderedFrame(0);
    }).to.throw(/stale/);

    // Releasing a stale instance must not touch the detached heap, but must
    // still mark the instance as released.
    dcmtk.release();
    dcmtk.release();
    expect(() => {
      dcmtk.getMetadata();
    }).to.throw(/released/);

    // The module itself remains usable after a re-initialization.
    const fresh = new Dcmtk();
    fresh.parseDataset(part10);
    const metadata = fresh.getMetadata();
    expect(metadata['00280010'].Value[0]).to.equal(height);
    fresh.release();
  });

  it('should reset the parsed state on release', () => {
    const width = 2;
    const height = 2;
    const pixels = Uint8Array.from({ length: width * height }, (_, i) => i);

    const part10 = createDicomPart10FromPixelData({
      pixelData: pixels.buffer,
      columns: width,
      rows: height,
    });

    const dcmtk = new Dcmtk();
    dcmtk.parseDataset(part10);
    expect(dcmtk._parsed).to.equal(true);
    // release() must reset _parsed to false so the instance's state is clean.
    dcmtk.release();
    expect(dcmtk._parsed).to.equal(false);
  });

  it('should throw when calling a method before parsing', () => {
    const dcmtk = new Dcmtk();
    expect(() => {
      dcmtk.getMetadata();
    }).to.throw(/No dataset has been parsed/);
    expect(() => {
      dcmtk.getUncompressedFrame(0);
    }).to.throw(/No dataset has been parsed/);
    expect(() => {
      dcmtk.getRenderedFrame(0);
    }).to.throw(/No dataset has been parsed/);
    dcmtk.release();
  });

  it('should normalize a Uint8Array input as-is', () => {
    const dcmtk = new Dcmtk();
    const input = new Uint8Array([1, 2, 3]);
    expect(dcmtk._toUint8Array(input)).to.equal(input);
    dcmtk.release();
  });

  it('should normalize a non-Uint8Array typed-array view', () => {
    const dcmtk = new Dcmtk();
    const result = dcmtk._toUint8Array(new Int16Array([1, 2, 3]));
    expect(result).to.be.instanceof(Uint8Array);
    dcmtk.release();
  });

  it('should normalize a plain number array', () => {
    const dcmtk = new Dcmtk();
    const result = dcmtk._toUint8Array([7, 8, 9]);
    expect(result).to.be.instanceof(Uint8Array);
    expect(Array.from(result)).to.deep.equal([7, 8, 9]);
    dcmtk.release();
  });

  it('should initialize with default options', async () => {
    await DcmtkModule.initializeAsync();
    expect(DcmtkModule.isInitialized()).to.equal(true);
  });

  it('should surface a thrown Error message from a wasm call', () => {
    // A wasm function that throws without going through onDcmtkException should
    // still surface the thrown error's message.
    expect(() => {
      DcmtkModule._callWasm(() => {
        throw new Error('boom');
      });
    }).to.throw('boom');
  });

  it('should stringify a non-Error thrown from a wasm call', () => {
    expect(() => {
      DcmtkModule._callWasm(() => {
        throw 'not an error';
      });
    }).to.throw('not an error');
  });
  it('should cache and rebuild the full-heap view', () => {
    // The first call builds and caches the view over the current heap.
    const heap8 = DcmtkModule._getHeap8();
    expect(heap8).to.be.instanceof(Uint8Array);
    expect(heap8.buffer).to.equal(DcmtkModule.wasmApi.wasmMemory.buffer);
    // A subsequent call returns the same cached view.
    expect(DcmtkModule._getHeap8()).to.equal(heap8);
    // Simulate a memory growth by detaching the cached view; the next call must
    // rebuild it over the current buffer.
    DcmtkModule.wasmApi.heap8 = undefined;
    const rebuilt = DcmtkModule._getHeap8();
    expect(rebuilt).to.not.equal(heap8);
    expect(rebuilt.buffer).to.equal(DcmtkModule.wasmApi.wasmMemory.buffer);
    // A stale view over a different buffer is also rebuilt.
    DcmtkModule.wasmApi.heap8 = new Uint8Array(new ArrayBuffer(8));
    const rebuiltAgain = DcmtkModule._getHeap8();
    expect(rebuiltAgain.buffer).to.equal(DcmtkModule.wasmApi.wasmMemory.buffer);
    // Leave the shared module's cache in a valid state for later tests.
    DcmtkModule.wasmApi.heap8 = rebuiltAgain;
  });
  it('should fall back to non-streaming instantiation when streaming fails', async () => {
    const originalStreaming = WebAssembly.instantiateStreaming;
    const originalInstantiate = WebAssembly.instantiate;
    let streamingCalled = false;
    let instantiateCalled = false;
    // Force the streaming path to reject so the fallback is exercised.
    WebAssembly.instantiateStreaming = async () => {
      streamingCalled = true;
      throw new Error('streaming unavailable');
    };
    WebAssembly.instantiate = async (bytes, imports) => {
      instantiateCalled = true;
      return originalInstantiate(bytes, imports);
    };
    try {
      await DcmtkModule.initializeAsync({ logMessages: false });
      expect(streamingCalled).to.equal(true);
      expect(instantiateCalled).to.equal(true);
      expect(DcmtkModule.isInitialized()).to.equal(true);
    } finally {
      WebAssembly.instantiateStreaming = originalStreaming;
      WebAssembly.instantiate = originalInstantiate;
    }
  });

  it('should report the module initialization state and release it', async () => {
    expect(DcmtkModule.isInitialized()).to.equal(true);
    DcmtkModule.release();
    expect(DcmtkModule.isInitialized()).to.equal(false);
    // Re-initialize so the shared module stays available for any later tests.
    await DcmtkModule.initializeAsync({ logMessages: false });
  });
});
