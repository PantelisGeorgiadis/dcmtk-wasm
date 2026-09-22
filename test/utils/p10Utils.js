const dcmjs = require('dcmjs');
const pako = require('pako');
const { DicomDict, DicomMetaDictionary, DicomMessage, WriteBufferStream } = dcmjs.data;
const { EXPLICIT_LITTLE_ENDIAN, DEFLATED_EXPLICIT_LITTLE_ENDIAN } = dcmjs.constants;
// Uncompressed (native) transfer syntax UIDs. Any other UID is treated as
// encapsulated, so PixelData is written as a single-fragment pixel sequence.
const NativeTransferSyntaxUids = [
  '1.2.840.10008.1.2', // Implicit VR Little Endian
  '1.2.840.10008.1.2.1', // Explicit VR Little Endian
  '1.2.840.10008.1.2.2', // Explicit VR Big Endian
];

/**
 * Creates a DICOM Part 10 buffer with a single PixelData element.
 * When transferSyntaxUid is an encapsulated (compressed) syntax, pixelData is
 * expected to already contain an encoded codestream/segment and is written as
 * a single-fragment encapsulated pixel sequence.
 * @param {Object} opts - Dataset options.
 * @param {ArrayBuffer} opts.pixelData - Combined (all frames) pixel data.
 * @param {number} opts.columns - Number of columns.
 * @param {number} opts.rows - Number of rows.
 * @param {number} [opts.bitsAllocated] - Bits allocated per sample. Default is 8.
 * @param {number} [opts.bitsStored] - Bits stored per sample. Default is bitsAllocated.
 * @param {number} [opts.samplesPerPixel] - Samples per pixel. Default is 1.
 * @param {string} [opts.photometricInterpretation] - Photometric interpretation.
 * Default is MONOCHROME2.
 * @param {number} [opts.pixelRepresentation] - Pixel representation (0: unsigned, 1: signed).
 * Default is 0.
 * @param {number} [opts.planarConfiguration] - Planar configuration (0: interleaved, 1: planar).
 * Only used when samplesPerPixel is greater than 1. Default is 0.
 * @param {number} [opts.numberOfFrames] - Number of frames. Default is 1.
 * @param {string} [opts.transferSyntaxUid] - Transfer syntax UID of pixelData.
 * Default is Explicit VR Little Endian (1.2.840.10008.1.2.1).
 * @param {Object} [opts.extraElements] - Additional DICOM elements to include (e.g. PatientName).
 * @param {boolean} [opts.omitPixelData] - When true, the dataset is written
 * without a PixelData element. Default is false.
 * @returns {ArrayBuffer} DICOM Part 10 buffer.
 */
function createDicomPart10FromPixelData(opts) {
  const {
    pixelData,
    columns,
    rows,
    bitsAllocated = 8,
    bitsStored = bitsAllocated,
    samplesPerPixel = 1,
    photometricInterpretation = 'MONOCHROME2',
    pixelRepresentation = 0,
    planarConfiguration = 0,
    numberOfFrames = 1,
    transferSyntaxUid = '1.2.840.10008.1.2.1',
    extraElements = {},
    omitPixelData = false,
  } = opts;

  const elements = {
    _meta: {
      FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
      MediaStorageSOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
      MediaStorageSOPInstanceUID: DicomMetaDictionary.uid(),
      TransferSyntaxUID: transferSyntaxUid,
      ImplementationClassUID: '1.2.276.0.7230010.3.0.3.6.4',
      ImplementationVersionName: 'DCMTK-WASM-TEST',
    },
    _vrMap: {
      PixelData: NativeTransferSyntaxUids.includes(transferSyntaxUid)
        ? bitsAllocated > 8
          ? 'OW'
          : 'OB'
        : 'OB',
    },
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
    SOPInstanceUID: DicomMetaDictionary.uid(),
    Rows: rows,
    Columns: columns,
    BitsAllocated: bitsAllocated,
    BitsStored: bitsStored,
    HighBit: bitsStored - 1,
    PixelRepresentation: pixelRepresentation,
    SamplesPerPixel: samplesPerPixel,
    PhotometricInterpretation: photometricInterpretation,
    NumberOfFrames: numberOfFrames,
    ...extraElements,
  };
  if (!omitPixelData) {
    elements.PixelData = [pixelData];
  }
  const denaturalizedMetaHeader = DicomMetaDictionary.denaturalizeDataset(elements._meta);
  const dicomDict = new DicomDict(denaturalizedMetaHeader);
  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(elements);

  return dicomDict.write();
}

/**
 * Creates a DICOM Part 10 buffer with a single PixelData element, where the
 * dataset (everything after the file meta header) is compressed with raw
 * deflate (Deflated Explicit VR Little Endian transfer syntax).
 *
 * DicomDict.write() always writes the dataset uncompressed, so this helper
 * replicates its layout (preamble + 'DICM' + FileMetaInformationGroupLength +
 * meta header) and then appends a pako.deflateRaw of the dataset.
 * @param {Object} opts - Dataset options (same as createDicomPart10FromPixelData).
 * @returns {ArrayBuffer} Deflated DICOM Part 10 buffer.
 */
function createDeflatedPart10FromPixelData(opts) {
  const {
    pixelData,
    columns,
    rows,
    bitsAllocated = 8,
    bitsStored = bitsAllocated,
    samplesPerPixel = 1,
    photometricInterpretation = 'MONOCHROME2',
    pixelRepresentation = 0,
    planarConfiguration = 0,
    numberOfFrames = 1,
    extraElements = {},
  } = opts;

  const elements = {
    _meta: {
      FileMetaInformationVersion: new Uint8Array([0, 1]).buffer,
      MediaStorageSOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
      MediaStorageSOPInstanceUID: DicomMetaDictionary.uid(),
      TransferSyntaxUID: DEFLATED_EXPLICIT_LITTLE_ENDIAN,
      ImplementationClassUID: '1.2.276.0.7230010.3.0.3.6.4',
      ImplementationVersionName: 'DCMTK-WASM-TEST',
    },
    _vrMap: {
      PixelData: bitsAllocated > 8 ? 'OW' : 'OB',
    },
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.7',
    SOPInstanceUID: DicomMetaDictionary.uid(),
    Rows: rows,
    Columns: columns,
    BitsAllocated: bitsAllocated,
    BitsStored: bitsStored,
    HighBit: bitsStored - 1,
    PixelRepresentation: pixelRepresentation,
    SamplesPerPixel: samplesPerPixel,
    PhotometricInterpretation: photometricInterpretation,
    NumberOfFrames: numberOfFrames,
    ...extraElements,
  };
  if (samplesPerPixel > 1) {
    elements.PlanarConfiguration = planarConfiguration;
  }
  elements.PixelData = [pixelData];

  const denaturalizedMetaHeader = DicomMetaDictionary.denaturalizeDataset(elements._meta);
  const dicomDict = new DicomDict(denaturalizedMetaHeader);
  dicomDict.dict = DicomMetaDictionary.denaturalizeDataset(elements);

  // Build the prefix: preamble + 'DICM' + group length tag + meta header.
  const fileStream = new WriteBufferStream(4096, true);
  fileStream.writeUint8Repeat(0, 128);
  fileStream.writeAsciiString('DICM');

  // Build the file meta header (uncompressed, explicit LE).
  const metaStream = new WriteBufferStream(1024);
  DicomMessage.write(dicomDict.meta, metaStream, EXPLICIT_LITTLE_ENDIAN, {
    allowInvalidVRLength: false,
  });

  // Write the FileMetaInformationGroupLength tag, then the meta header.
  DicomMessage.writeTagObject(
    fileStream,
    '00020000',
    'UL',
    metaStream.size,
    EXPLICIT_LITTLE_ENDIAN,
    { allowInvalidVRLength: false }
  );
  fileStream.concat(metaStream);

  // Grab the prefix bytes (preamble + DICM + group length + meta).
  const prefix = new Uint8Array(fileStream.getBuffer(0, fileStream.size));

  // Build the dataset (uncompressed, explicit LE), then deflate it.
  const dictStream = new WriteBufferStream(4096, true);
  DicomMessage.write(dicomDict.dict, dictStream, EXPLICIT_LITTLE_ENDIAN, {
    allowInvalidVRLength: false,
  });
  const deflatedDict = pako.deflateRaw(dictStream.getBuffer(0, dictStream.size));

  // Concatenate prefix + deflated dataset.
  const result = new Uint8Array(prefix.length + deflatedDict.length);
  result.set(prefix, 0);
  result.set(deflatedDict, prefix.length);

  return result.buffer;
}

module.exports = {
  createDicomPart10FromPixelData,
  createDeflatedPart10FromPixelData,
};
