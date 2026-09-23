#include <dcmtk/dcmdata/dccodec.h>
#include <dcmtk/dcmdata/dcdeftag.h>
#include <dcmtk/dcmdata/dcfilefo.h>
#include <dcmtk/dcmdata/dcistrmb.h>
#include <dcmtk/dcmdata/dcjson.h>
#include <dcmtk/dcmdata/dcmetinf.h>
#include <dcmtk/dcmdata/dcpixel.h>
#include <dcmtk/dcmdata/dcpixseq.h>
#include <dcmtk/dcmdata/dcpxitem.h>
#include <dcmtk/dcmdata/dcxfer.h>
#include <dcmtk/dcmimgle/dcmimage.h>
#include <emscripten.h>

#include <algorithm>
#include <memory>
#include <sstream>
#include <vector>

#include "Bmp.h"
#include "Buffer.h"
#include "Codecs/DcmtkCodecs.h"
#include "DcmtkContext.h"
#include "Exception.h"

using namespace std;

// Register DCMTK codecs during module initialization.
// The static object's constructor runs once when the module loads, so the
// JPEG/RLE/etc. decoders are available before any dataset is parsed.
static DcmtkCodecs const dcmtkCodecs;

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Rejects transfer syntaxes that DCMTK cannot decode to uncompressed pixel
// data. Encapsulated (compressed) syntaxes are only allowed when a codec can
// convert them to Explicit VR Little Endian; anything else (e.g. MPEG2) is
// unsupported and throws with a descriptive, context-prefixed message.
static void ThrowIfUnsupportedTransferSyntax(DcmDataset const *dataset,
                                             char const *context) {
  // The original transfer syntax is the one the dataset was read with.
  DcmXfer const xfer(dataset->getOriginalXfer());
  if (xfer.usesEncapsulatedFormat() &&
      !DcmCodecList::canChangeCoding(xfer.getXfer(),
                                     EXS_LittleEndianExplicit)) {
    ThrowDcmtkException(string(context) + "::Unsupported transfer syntax: " +
                        string(xfer.getXferName()));
  }
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Returns the Float Pixel Data (7FE0,0008) or Double Float Pixel Data
// (7FE0,0009) element of the dataset, or nullptr when neither is present.
// These non-standard pixel data carriers are used by some parametric map
// (e.g. T1/T2 map) datasets instead of the standard Pixel Data (7FE0,0010).
static DcmElement *FindFloatPixelDataElement(DcmDataset *dataset) {
  DcmElement *element = nullptr;
  if (dataset->findAndGetElement(DCM_FloatPixelData, element).good() &&
      element != nullptr) {
    return element;
  }
  element = nullptr;
  if (dataset->findAndGetElement(DCM_DoubleFloatPixelData, element).good() &&
      element != nullptr) {
    return element;
  }

  return nullptr;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Builds a temporary dataset containing the requested frame of the given float
// pixel data element as standard 16-bit MONOCHROME2 Pixel Data. The float
// values of the frame are scaled linearly to the full 16-bit range using the
// frame's own minimum and maximum, which gives a reasonable per-frame display
// window for parametric maps. The temporary dataset carries the pixel
// description attributes from the original dataset so that DicomImage can be
// created from it. The caller owns the returned dataset.
static DcmDataset *CreateTempDatasetFromFloatFrame(DcmDataset *dataset,
                                                   DcmElement *pixelElement,
                                                   size_t const frameIndex) {
  // Read the pixel geometry from the original dataset.
  Uint16 columns = 0;
  Uint16 rows = 0;
  dataset->findAndGetUint16(DCM_Columns, columns);
  dataset->findAndGetUint16(DCM_Rows, rows);
  if (columns == 0 || rows == 0) {
    ThrowDcmtkException(
        "GetRenderedFrame::FloatPixelData::Missing Columns or Rows");
  }

  // Determine the per-sample size from the element's VR: OF (32-bit float) or
  // OD (64-bit double).
  auto const vr = pixelElement->getVR();
  size_t sampleSize = 0;
  if (vr == EVR_OF) {
    sampleSize = sizeof(Float32);
  } else if (vr == EVR_OD) {
    sampleSize = sizeof(Float64);
  } else {
    ThrowDcmtkException(
        "GetRenderedFrame::FloatPixelData::Unexpected value representation");
  }

  // Validate that the element holds enough samples for the requested frame.
  auto const framePixels = static_cast<size_t>(columns) * rows;
  auto const totalSamples =
      static_cast<size_t>(pixelElement->getLength()) / sampleSize;
  auto const frameStart = frameIndex * framePixels;
  if (frameStart + framePixels > totalSamples) {
    ThrowDcmtkException(
        "GetRenderedFrame::FloatPixelData::Pixel data too small for frame " +
        to_string(frameIndex));
  }

  // Copy the frame's samples into a local float buffer, converting doubles to
  // floats on the way when needed.
  vector<float> samples(framePixels);
  if (vr == EVR_OF) {
    Float32 *floatValues = nullptr;
    if (pixelElement->getFloat32Array(floatValues).bad() ||
        floatValues == nullptr) {
      ThrowDcmtkException(
          "GetRenderedFrame::FloatPixelData::getFloat32Array::Value not found");
    }
    auto const *source = reinterpret_cast<float const *>(floatValues);
    copy(source + frameStart, source + frameStart + framePixels,
         samples.begin());
  } else {
    Float64 *doubleValues = nullptr;
    if (pixelElement->getFloat64Array(doubleValues).bad() ||
        doubleValues == nullptr) {
      ThrowDcmtkException(
          "GetRenderedFrame::FloatPixelData::"
          "getFloat64Array::Value not found");
    }
    auto const *source = reinterpret_cast<double const *>(doubleValues);
    transform(source + frameStart, source + frameStart + framePixels,
              samples.begin(),
              [](double const value) { return static_cast<float>(value); });
  }

  // Compute the frame's min/max, ignoring NaN values, and scale the samples
  // linearly to the full 16-bit range. A constant frame maps to mid-gray.
  float minValue = 0;
  float maxValue = 0;
  bool haveValue = false;
  for (auto const value : samples) {
    if (value != value) {  // NaN
      continue;
    }
    if (!haveValue || value < minValue) {
      minValue = value;
    }
    if (!haveValue || value > maxValue) {
      maxValue = value;
    }
    haveValue = true;
  }
  if (!haveValue) {
    ThrowDcmtkException(
        "GetRenderedFrame::FloatPixelData::Frame has no valid values");
  }

  vector<Uint16> pixels(framePixels);
  auto const range = static_cast<double>(maxValue) - minValue;
  for (size_t i = 0; i < framePixels; ++i) {
    auto const value = samples[i];
    if (value != value) {  // NaN renders as black
      pixels[i] = 0;
    } else if (range == 0) {
      pixels[i] = 32768;
    } else {
      pixels[i] = static_cast<Uint16>((static_cast<double>(value) - minValue) /
                                      range * 65535.0);
    }
  }

  // Build the temporary dataset with the pixel description attributes and the
  // scaled 16-bit pixel data.
  auto *tempDataset = new DcmDataset();
  tempDataset->putAndInsertUint16(DCM_Columns, columns);
  tempDataset->putAndInsertUint16(DCM_Rows, rows);
  tempDataset->putAndInsertUint16(DCM_SamplesPerPixel, 1);
  tempDataset->putAndInsertString(DCM_PhotometricInterpretation, "MONOCHROME2");
  tempDataset->putAndInsertUint16(DCM_BitsAllocated, 16);
  tempDataset->putAndInsertUint16(DCM_BitsStored, 16);
  tempDataset->putAndInsertUint16(DCM_HighBit, 15);
  tempDataset->putAndInsertUint16(DCM_PixelRepresentation, 0);
  tempDataset->putAndInsertUint16Array(DCM_PixelData, pixels.data(),
                                       static_cast<unsigned long>(framePixels));

  return tempDataset;
}

extern "C" {
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Parses a DICOM Part 10 buffer (held in the context's encoded buffer) into an
// in-memory DcmDataset, replacing any previously parsed dataset.
EMSCRIPTEN_KEEPALIVE void ParseDataset(DcmtkContext *ctx) {
  // Wrap the encoded buffer as an in-memory input stream.
  DcmInputBufferStream is;
  auto const size = GetEncodedBufferSize(ctx);
  if (size > 0) {
    is.setBuffer(GetEncodedBuffer(ctx), size);
  }
  // Mark end-of-stream so the reader knows the buffer boundary.
  is.setEos();

  // DcmFileFormat reads the file meta-information and dataset.
  DcmFileFormat ff;
  ff.transferInit();
  // Read the whole file from the stream.
  auto const cond = ff.read(is);
  if (cond.bad()) {
    ThrowDcmtkException("ParseDataset::read::" + string(cond.text()));
  }
  // Pull all pixel data into memory so it survives after the stream closes.
  ff.loadAllDataIntoMemory();
  ff.transferEnd();

  // Validate that a dataset was actually produced.
  auto dataset = ff.getDataset();
  if (dataset == nullptr) {
    ThrowDcmtkException("ParseDataset::getDataset::Dataset is null");
  }

  // Replace the context's dataset, freeing the previous one to avoid a leak.
  delete ctx->Dataset;
  ctx->Dataset = ff.getAndRemoveDataset();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Serializes the parsed dataset to compact JSON, excluding PixelData, and
// copies the result into the metadata context's buffer.
EMSCRIPTEN_KEEPALIVE void GetMetadataAsJson(DcmtkContext const *ctx,
                                            MetadataContext *metadataCtx) {
  if (ctx->Dataset == nullptr) {
    ThrowDcmtkException("GetMetadata::Dataset is null");
  }

  // Temporarily detach the pixel data elements (standard PixelData as well as
  // Float and Double Float Pixel Data) so they never appear in the metadata
  // JSON. The RAII guard re-inserts the elements on scope exit (including when
  // an exception is thrown), so the dataset is left unchanged. For absent
  // tags, remove() returns nullptr and the guard skips the re-insertion.
  struct PixelDataOmissionGuard {
    DcmDataset *Dataset;
    DcmElement *Elements[3];
    ~PixelDataOmissionGuard() {
      for (auto &element : Elements) {
        if (element != nullptr) {
          Dataset->insert(element, true);
        }
      }
    }
  } const pixelDataOmissionGuard{
      ctx->Dataset,
      {ctx->Dataset->remove(DCM_PixelData),
       ctx->Dataset->remove(DCM_FloatPixelData),
       ctx->Dataset->remove(DCM_DoubleFloatPixelData)}};

  // Build a compact JSON writer with sensible defaults.
  ostringstream jsonOutputStream;
  DcmJsonFormatCompact fmt(true);
  // Disable the JSON extension (e.g. the "dcmtk" namespace wrapper).
  fmt.setJsonExtensionEnabled(false);
  // Let DCMTK decide per-element whether numbers are strings or numbers.
  fmt.setJsonNumStringPolicy(DcmJsonFormat::NSP_auto);
  // Force all bulk data inline (no external file references), which is the
  // only option available in a filesystem-less wasm environment.
  fmt.setMinBulkSize(-1);

  // Write the dataset to the stream.
  auto const result =
      ctx->Dataset->writeJsonExt(jsonOutputStream, fmt, true, true);
  if (!result.good()) {
    ThrowDcmtkException("GetMetadata::writeJsonExt::" + string(result.text()));
  }

  // Copy the serialized JSON into the metadata context's output buffer.
  auto const metadataJson = jsonOutputStream.str();
  SetMetadataContextMetadataBufferSize(metadataCtx, metadataJson.size());
  copy(metadataJson.begin(), metadataJson.end(),
       GetMetadataContextMetadataBuffer(metadataCtx));
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Renders the requested frame of the parsed dataset to an 8-bit RGB BMP image
// and copies it into the frame context's pixel-data buffer.
EMSCRIPTEN_KEEPALIVE void GetRenderedFrameAsBmp(DcmtkContext const *ctx,
                                                FrameContext *frameCtx) {
  if (ctx->Dataset == nullptr) {
    ThrowDcmtkException("GetRenderedFrame::Dataset is null");
  }

  // Rendering requires pixel data to be present. Some parametric map datasets
  // carry their pixels in Float (7FE0,0008) or Double Float Pixel Data
  // (7FE0,0009) instead, which DicomImage cannot read directly.
  auto const hasStandardPixelData =
      ctx->Dataset->tagExistsWithValue(DCM_PixelData);
  DcmElement *floatPixelDataElement =
      hasStandardPixelData ? nullptr : FindFloatPixelDataElement(ctx->Dataset);
  if (!hasStandardPixelData && floatPixelDataElement == nullptr) {
    ThrowDcmtkException("GetRenderedFrame::Dataset does not contain PixelData");
  }

  // Reject transfer syntaxes that cannot be decoded to uncompressed pixels.
  // Float pixel data is always uncompressed, so this only applies to standard
  // Pixel Data.
  if (hasStandardPixelData) {
    ThrowIfUnsupportedTransferSyntax(ctx->Dataset, "GetRenderedFrame");
  }

  // Determine the number of frames; default to 1 when the tag is absent or
  // non-positive (single-frame datasets often omit it).
  long int numberOfFrames = 1;
  if (ctx->Dataset->findAndGetLongInt(DCM_NumberOfFrames, numberOfFrames)
          .bad() ||
      numberOfFrames <= 0) {
    numberOfFrames = 1;
  }

  // Validate the requested frame index against the dataset's frame count.
  // (The image itself is created with a single-frame window below, so its own
  // frame count is not usable for validation.)
  auto const frameIndex = GetFrameContextFrameIndex(frameCtx);
  if (frameIndex >= static_cast<size_t>(numberOfFrames)) {
    ThrowDcmtkException(
        "GetRenderedFrame::FrameIndex out of range: " + to_string(frameIndex) +
        " >= NumberOfFrames: " + to_string(numberOfFrames));
  }

  // Build a high-level image from the dataset and its original transfer
  // syntax, restricted to the requested frame. The partial-access flag makes
  // DCMTK decode only that one frame instead of decompressing every frame of
  // (possibly compressed) pixel data into memory up front, which would fail
  // for large multi-frame datasets. For float pixel data, the requested frame
  // is first scaled into a temporary single-frame 16-bit dataset that
  // DicomImage can read.
  unique_ptr<DcmDataset> tempDataset;
  DcmObject *imageSource = ctx->Dataset;
  auto imageXfer = ctx->Dataset->getOriginalXfer();
  auto imageFlags = CIF_UsePartialAccessToPixelData;
  auto imageStartFrame = static_cast<unsigned long>(frameIndex);
  if (floatPixelDataElement != nullptr) {
    tempDataset.reset(CreateTempDatasetFromFloatFrame(
        ctx->Dataset, floatPixelDataElement, frameIndex));
    imageSource = tempDataset.get();
    imageXfer = EXS_LittleEndianExplicit;
    imageFlags = 0;
    // The temporary dataset already contains only the requested frame.
    imageStartFrame = 0;
  }
  DicomImage image(imageSource, imageXfer, imageFlags, imageStartFrame, 1UL);
  if (image.getStatus() != EIS_Normal) {
    ThrowDcmtkException("GetRenderedFrame::DicomImage::" +
                        string(DicomImage::getString(image.getStatus())));
  }
  // Auto-window using the min/max pixel values for a reasonable display.
  // setMinMaxWindow only affects monochrome (grayscale) images; for color
  // images it is a no-op, so skip the call entirely for RGB/YBR images.
  if (image.isMonochrome()) {
    image.setMinMaxWindow();
  }

  // Render the frame to a BMP byte buffer. Frame indices are relative to the
  // image's start frame, which is the requested frame, so render frame 0.
  auto const bmp = WriteBmp(image, 0);

  // Record the rendered image's properties: 8-bit, 3-sample RGB, interleaved.
  SetFrameContextColumns(frameCtx, image.getWidth());
  SetFrameContextRows(frameCtx, image.getHeight());
  SetFrameContextBitsAllocated(frameCtx, 8);
  SetFrameContextBitsStored(frameCtx, 8);
  SetFrameContextSamplesPerPixel(frameCtx, 3);
  SetFrameContextPixelRepresentation(frameCtx, 0);
  SetFrameContextPlanarConfiguration(frameCtx, 0);
  SetFrameContextPhotometricInterpretation(frameCtx, "RGB");

  // Copy the BMP bytes into the frame context's output buffer.
  SetFrameContextPixelDataBufferSize(frameCtx, bmp.size());
  copy(bmp.begin(), bmp.end(), GetFrameContextPixelDataBuffer(frameCtx));
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Decodes a single frame of the parsed dataset to uncompressed pixel data and
// copies it into the frame context's pixel-data buffer, along with the pixel
// geometry. The dataset's original (possibly compressed) representation is left
// untouched.
EMSCRIPTEN_KEEPALIVE void GetUncompressedFrame(DcmtkContext const *ctx,
                                               FrameContext *frameCtx) {
  if (ctx->Dataset == nullptr) {
    ThrowDcmtkException("GetUncompressedFrame::Dataset is null");
  }

  // Decoding requires pixel data to be present.
  if (!ctx->Dataset->tagExistsWithValue(DCM_PixelData)) {
    ThrowDcmtkException(
        "GetUncompressedFrame::Dataset does not contain PixelData");
  }

  // Reject transfer syntaxes that cannot be decoded to uncompressed pixels.
  ThrowIfUnsupportedTransferSyntax(ctx->Dataset, "GetUncompressedFrame");

  // Determine the number of frames; default to 1 when the tag is absent or
  // non-positive (single-frame datasets often omit it).
  long int numberOfFrames = 1;
  if (ctx->Dataset->findAndGetLongInt(DCM_NumberOfFrames, numberOfFrames)
          .bad() ||
      numberOfFrames <= 0) {
    numberOfFrames = 1;
  }

  // Validate the requested frame index against the frame count.
  auto const frame = GetFrameContextFrameIndex(frameCtx);
  if (frame >= static_cast<size_t>(numberOfFrames)) {
    ThrowDcmtkException(
        "GetUncompressedFrame::FrameIndex out of range: " + to_string(frame) +
        " >= NumberOfFrames: " + to_string(numberOfFrames));
  }

  // Read the pixel geometry from the dataset.
  Uint16 columns = 0;
  Uint16 rows = 0;
  Uint16 bitsAllocated = 0;
  Uint16 bitsStored = 0;
  Uint16 samplesPerPixel = 0;
  Uint16 pixelRepresentation = 0;
  Uint16 planarConfiguration = 0;
  ctx->Dataset->findAndGetUint16(DCM_Columns, columns);
  ctx->Dataset->findAndGetUint16(DCM_Rows, rows);
  ctx->Dataset->findAndGetUint16(DCM_BitsAllocated, bitsAllocated);
  ctx->Dataset->findAndGetUint16(DCM_BitsStored, bitsStored);
  ctx->Dataset->findAndGetUint16(DCM_SamplesPerPixel, samplesPerPixel);
  ctx->Dataset->findAndGetUint16(DCM_PixelRepresentation, pixelRepresentation);
  // Planar configuration is only meaningful for multi-sample pixels.
  if (samplesPerPixel > 1) {
    ctx->Dataset->findAndGetUint16(DCM_PlanarConfiguration,
                                   planarConfiguration);
  }

  // Locate the PixelData element to decode from.
  DcmElement *pixelElement = nullptr;
  auto result = ctx->Dataset->findAndGetElement(DCM_PixelData, pixelElement);
  if (result.bad() || pixelElement == nullptr) {
    ThrowDcmtkException(
        "GetUncompressedFrame::findAndGetElement::Pixel data not found");
  }

  // Decode only the requested frame in place, without mutating the dataset's
  // pixel data representation (i.e. no chooseRepresentation call), so that
  // the (possibly compressed) original representation is left untouched.
  // The original transfer syntax tells us whether the stored pixel data is
  // already uncompressed or needs decoding.
  DcmXfer const originalXfer(ctx->Dataset->getOriginalXfer());
  auto const pixelDataIsUncompressed =
      !originalXfer.usesEncapsulatedFormat() ? OFTrue : OFFalse;

  // Query the size of the uncompressed frame before allocating a buffer.
  Uint32 frameSize = 0;
  result = pixelElement->getUncompressedFrameSize(ctx->Dataset, frameSize,
                                                  pixelDataIsUncompressed);
  if (result.bad() || frameSize == 0) {
    ThrowDcmtkException("GetUncompressedFrame::getUncompressedFrameSize::" +
                        string(result.text()));
  }

  // getUncompressedFrame requires an even-sized buffer since the decoder may
  // need to byte-swap into it.
  auto const bufferSize = frameSize + (frameSize % 2 == 0 ? 0 : 1);
  vector<uint8_t> frameBuffer(bufferSize);

  // Decode the requested frame into the buffer. startFragment is an in/out
  // parameter (0 for the first fragment); photometricInterpretation is filled
  // in by the decoder.
  Uint32 startFragment = 0;
  OFString photometricInterpretation;
  result = pixelElement->getUncompressedFrame(
      ctx->Dataset, static_cast<Uint32>(frame), startFragment,
      frameBuffer.data(), bufferSize, photometricInterpretation);
  if (result.bad()) {
    ThrowDcmtkException("GetUncompressedFrame::getUncompressedFrame::" +
                        string(result.text()));
  }

  // Record the pixel geometry and photometric interpretation.
  SetFrameContextColumns(frameCtx, columns);
  SetFrameContextRows(frameCtx, rows);
  SetFrameContextBitsAllocated(frameCtx, bitsAllocated);
  SetFrameContextBitsStored(frameCtx, bitsStored);
  SetFrameContextSamplesPerPixel(frameCtx, samplesPerPixel);
  SetFrameContextPixelRepresentation(frameCtx, pixelRepresentation);
  SetFrameContextPlanarConfiguration(frameCtx, planarConfiguration);
  SetFrameContextPhotometricInterpretation(frameCtx,
                                           photometricInterpretation.c_str());

  // Copy the decoded frame bytes into the frame context's output buffer.
  SetFrameContextPixelDataBufferSize(frameCtx, frameSize);
  copy(frameBuffer.begin(), frameBuffer.begin() + frameSize,
       GetFrameContextPixelDataBuffer(frameCtx));
}
}
