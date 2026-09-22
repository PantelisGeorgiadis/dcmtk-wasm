const DcmtkModule = require('./DcmtkModule');

//#region Dcmtk
/**
 * Wraps a single parsed DICOM P10 dataset.
 * Holds a native DcmtkContext alive so the parsed dataset can be reused for
 * multiple metadata/frame calls without re-parsing the source buffer.
 * DcmtkModule.initializeAsync() must be called once before creating instances.
 */
class Dcmtk {
  /**
   * Creates an instance of Dcmtk. Call parseDataset() to parse a DICOM P10
   * byte stream before using any other method.
   * @constructor
   * @throws Error if the Dcmtk module is not initialized.
   */
  constructor() {
    DcmtkModule._throwIfDcmtkModuleIsNotInitialized();
    this._released = false;
    this._parsed = false;
    this._ctx = DcmtkModule.wasmApi.wasmCreateDcmtkContext();
  }

  /**
   * Parses the given DICOM P10 data. May be called again on the same
   * instance to replace the currently parsed dataset.
   * @method
   * @param {ArrayBuffer|Uint8Array|Buffer|Array<number>} data - DICOM P10 data.
   * @throws Error if this instance has been released, or if parsing fails.
   */
  parseDataset(data) {
    this._throwIfReleased();

    const bytes = this._toUint8Array(data);
    DcmtkModule.wasmApi.wasmSetEncodedBufferSize(this._ctx, bytes.length);
    const encodedDataPointer = DcmtkModule.wasmApi.wasmGetEncodedBuffer(this._ctx);
    const heap8 = DcmtkModule._getHeap8();
    heap8.set(bytes, encodedDataPointer);

    DcmtkModule._callWasm(DcmtkModule.wasmApi.wasmParseDataset, this._ctx);
    this._parsed = true;
  }

  /**
   * Gets the dataset metadata (attributes other than pixel data) as a JSON object.
   * @method
   * @returns {Object} Dataset metadata.
   * @throws Error if this instance has been released, or if no dataset has been parsed.
   */
  getMetadata() {
    this._throwIfNotParsed();

    const metadataCtx = DcmtkModule.wasmApi.wasmCreateMetadataContext();
    try {
      DcmtkModule._callWasm(DcmtkModule.wasmApi.wasmGetMetadataAsJson, this._ctx, metadataCtx);

      const metadataPointer = DcmtkModule.wasmApi.wasmGetMetadataContextMetadataBuffer(metadataCtx);
      const metadataSize =
        DcmtkModule.wasmApi.wasmGetMetadataContextMetadataBufferSize(metadataCtx);
      const metadataText = DcmtkModule._wasmMemoryToJsString(metadataPointer, metadataSize);

      return JSON.parse(metadataText);
    } finally {
      DcmtkModule.wasmApi.wasmReleaseMetadataContext(metadataCtx);
    }
  }

  /**
   * Renders a frame to a BMP image.
   * @method
   * @param {number} [frameIndex] - Zero-based frame index to render.
   * @returns {Object} Frame object. The pixelData property contains a full BMP file.
   * @throws Error if this instance has been released, if no dataset has been parsed,
   * or if frameIndex is out of range.
   */
  getRenderedFrame(frameIndex = 0) {
    return this._getFrame(frameIndex, DcmtkModule.wasmApi.wasmGetRenderedFrameAsBmp);
  }

  /**
   * Decodes a frame to its uncompressed pixel data.
   * @method
   * @param {number} [frameIndex] - Zero-based frame index to decode.
   * @returns {Object} Frame object. The pixelData property contains raw uncompressed pixels.
   * @throws Error if this instance has been released, if no dataset has been parsed,
   * or if frameIndex is out of range.
   */
  getUncompressedFrame(frameIndex = 0) {
    return this._getFrame(frameIndex, DcmtkModule.wasmApi.wasmGetUncompressedFrame);
  }

  /**
   * Releases the underlying native DcmtkContext.
   * Safe to call multiple times. No other method may be called afterward.
   * @method
   */
  release() {
    if (this._released) {
      return;
    }

    DcmtkModule.wasmApi.wasmReleaseDcmtkContext(this._ctx);
    this._ctx = undefined;
    this._parsed = false;
    this._released = true;
  }

  //#region Private Methods
  /**
   * Populates a FrameContext with the given frame index, invokes the given
   * wasm frame extraction function, and reads the resulting frame attributes
   * and pixel data back into a plain JS object.
   * @method
   * @private
   * @param {number} frameIndex - Zero-based frame index.
   * @param {Function} wasmFrameFn - wasmGetRenderedFrameAsBmp or wasmGetUncompressedFrame.
   * @returns {Object} Frame object.
   * @throws Error if this instance has been released, if no dataset has been parsed,
   * or if frameIndex is out of range.
   */
  _getFrame(frameIndex, wasmFrameFn) {
    this._throwIfNotParsed();

    const frameCtx = DcmtkModule.wasmApi.wasmCreateFrameContext();
    try {
      DcmtkModule.wasmApi.wasmSetFrameContextFrameIndex(frameCtx, frameIndex);
      DcmtkModule._callWasm(wasmFrameFn, this._ctx, frameCtx);

      const pixelDataPointer = DcmtkModule.wasmApi.wasmGetFrameContextPixelDataBuffer(frameCtx);
      const pixelDataSize = DcmtkModule.wasmApi.wasmGetFrameContextPixelDataBufferSize(frameCtx);
      const heap8 = DcmtkModule._getHeap8();
      const pixelData = heap8.slice(pixelDataPointer, pixelDataPointer + pixelDataSize);

      return {
        frameIndex: DcmtkModule.wasmApi.wasmGetFrameContextFrameIndex(frameCtx),
        columns: DcmtkModule.wasmApi.wasmGetFrameContextColumns(frameCtx),
        rows: DcmtkModule.wasmApi.wasmGetFrameContextRows(frameCtx),
        bitsAllocated: DcmtkModule.wasmApi.wasmGetFrameContextBitsAllocated(frameCtx),
        bitsStored: DcmtkModule.wasmApi.wasmGetFrameContextBitsStored(frameCtx),
        samplesPerPixel: DcmtkModule.wasmApi.wasmGetFrameContextSamplesPerPixel(frameCtx),
        pixelRepresentation: DcmtkModule.wasmApi.wasmGetFrameContextPixelRepresentation(frameCtx),
        planarConfiguration: DcmtkModule.wasmApi.wasmGetFrameContextPlanarConfiguration(frameCtx),
        photometricInterpretation: DcmtkModule.wasmCStringToJsString(
          DcmtkModule.wasmApi.wasmGetFrameContextPhotometricInterpretation(frameCtx)
        ),
        pixelData,
      };
    } finally {
      DcmtkModule.wasmApi.wasmReleaseFrameContext(frameCtx);
    }
  }

  /**
   * Normalizes various byte-container types to a Uint8Array.
   * @method
   * @private
   * @param {ArrayBuffer|Uint8Array|Buffer|Array&lt;number&gt;} data - Byte data.
   * @returns {Uint8Array} The normalized byte array.
   */
  _toUint8Array(data) {
    if (data instanceof Uint8Array) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (ArrayBuffer.isView(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    return new Uint8Array(data);
  }

  /**
   * Throws error in case this instance has been released.
   * @method
   * @private
   * @throws Error if this instance has been released.
   */
  _throwIfReleased() {
    if (this._released) {
      throw new Error('Dcmtk instance has been released');
    }
  }

  /**
   * Throws error in case this instance has been released or no dataset has been parsed yet.
   * @method
   * @private
   * @throws Error if this instance has been released, or if no dataset has been parsed.
   */
  _throwIfNotParsed() {
    this._throwIfReleased();
    if (!this._parsed) {
      throw new Error('No dataset has been parsed. Call parseDataset() first');
    }
  }
  //#endregion
}
//#endregion

//#region Exports
module.exports = Dcmtk;
//#endregion
