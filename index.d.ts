import log from 'loglevel';

/**
 * Frame object returned by Dcmtk.getRenderedFrame() and
 * Dcmtk.getUncompressedFrame().
 */
declare interface DcmtkFrame {
  /**
   * Zero-based index of the frame.
   */
  frameIndex: number;

  /**
   * Number of columns (width).
   */
  columns: number;

  /**
   * Number of rows (height).
   */
  rows: number;

  /**
   * Bits allocated per sample.
   */
  bitsAllocated: number;

  /**
   * Bits stored per sample.
   */
  bitsStored: number;

  /**
   * Samples per pixel (1 for grayscale, 3 for RGB/YBR).
   */
  samplesPerPixel: number;

  /**
   * 0 for unsigned, 1 for signed.
   */
  pixelRepresentation: number;

  /**
   * 0 for interleaved, 1 for planar.
   */
  planarConfiguration: number;

  /**
   * Photometric interpretation, e.g. MONOCHROME2, RGB, YBR_RCT.
   */
  photometricInterpretation: string;

  /**
   * A full BMP file for getRenderedFrame(), or raw uncompressed pixels
   * for getUncompressedFrame().
   */
  pixelData: Uint8Array;
}

declare class Dcmtk {
  /**
   * Creates an instance of Dcmtk. Call parseDataset() to parse a DICOM P10
   * byte stream before using any other method.
   * DcmtkModule.initializeAsync() must be called once before creating
   * instances.
   */
  constructor();

  /**
   * Parses the given DICOM P10 data. May be called again on the same instance
   * to replace the currently parsed dataset.
   */
  parseDataset(data: ArrayBuffer | Uint8Array | ArrayBufferView | Array<number>): void;

  /**
   * Gets the dataset metadata (attributes other than pixel data) as a JSON
   * object, keyed by 8-character hexadecimal DICOM tags.
   */
  getMetadata(): Record<string, unknown>;

  /**
   * Renders a frame to a BMP image. The pixelData property of the returned
   * frame contains a full BMP file.
   */
  getRenderedFrame(frameIndex?: number): DcmtkFrame;

  /**
   * Decodes a frame to its uncompressed pixel data. The pixelData property of
   * the returned frame contains raw uncompressed pixels.
   */
  getUncompressedFrame(frameIndex?: number): DcmtkFrame;

  /**
   * Releases the underlying native DcmtkContext. Safe to call multiple times.
   * No other method may be called afterward.
   */
  release(): void;
}

declare class DcmtkModule {
  /**
   * Initializes the shared Dcmtk WebAssembly module.
   */
  static initializeAsync(opts?: {
    webAssemblyModulePathOrUrl?: string;
    logMessages?: boolean;
  }): Promise<void>;

  /**
   * Checks if the Dcmtk WebAssembly module is initialized.
   */
  static isInitialized(): boolean;

  /**
   * Releases the Dcmtk WebAssembly module.
   */
  static release(): void;
}

/**
 * Version.
 */
declare const version: string;

export { Dcmtk, DcmtkModule, DcmtkFrame, log, version };
