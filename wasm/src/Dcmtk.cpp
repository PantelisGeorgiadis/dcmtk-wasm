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

  // Temporarily detach PixelData so it never appears in the metadata JSON.
  // The RAII guard re-inserts the element on scope exit (including when an
  // exception is thrown), so the dataset is left unchanged. When the dataset
  // has no PixelData, remove() returns nullptr and the guard is a no-op.
  struct PixelDataOmissionGuard {
    DcmDataset *Dataset;
    DcmElement *Element;
    ~PixelDataOmissionGuard() {
      if (Element != nullptr) {
        Dataset->insert(Element, true);
      }
    }
  } const pixelDataOmissionGuard{ctx->Dataset,
                                 ctx->Dataset->remove(DCM_PixelData)};

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
  // Rendering requires pixel data to be present.
  if (!ctx->Dataset->tagExistsWithValue(DCM_PixelData)) {
    ThrowDcmtkException("GetRenderedFrame::Dataset does not contain PixelData");
  }
  // Reject transfer syntaxes that cannot be decoded to uncompressed pixels.
  ThrowIfUnsupportedTransferSyntax(ctx->Dataset, "GetRenderedFrame");

  // Build a high-level image from the dataset and its original transfer syntax.
  DicomImage image(ctx->Dataset, ctx->Dataset->getOriginalXfer());
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
  // Validate the requested frame index against the image's frame count.
  auto const frameIndex = GetFrameContextFrameIndex(frameCtx);
  if (frameIndex >= image.getFrameCount()) {
    ThrowDcmtkException("GetRenderedFrame::FrameIndex out of range: " +
                        to_string(frameIndex));
  }

  // Render the frame to a BMP byte buffer.
  auto const bmp = WriteBmp(image, frameIndex);

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
