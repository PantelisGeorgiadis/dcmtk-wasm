#include "DcmtkContext.h"

#include <cstring>

extern "C" {
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE DcmtkContext *CreateDcmtkContext(void) {
  return new DcmtkContext;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void ReleaseDcmtkContext(DcmtkContext const *ctx) {
  delete ctx;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE uint8_t *GetEncodedBuffer(DcmtkContext const *ctx) {
  return ctx->EncodedBuffer.GetData();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t GetEncodedBufferSize(DcmtkContext const *ctx) {
  return ctx->EncodedBuffer.GetSize();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetEncodedBufferSize(DcmtkContext *ctx,
                                               size_t const size) {
  ctx->EncodedBuffer.Reset(size);
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE MetadataContext *CreateMetadataContext(void) {
  return new MetadataContext;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void ReleaseMetadataContext(MetadataContext const *ctx) {
  delete ctx;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE uint8_t *GetMetadataContextMetadataBuffer(
    MetadataContext const *ctx) {
  return ctx->MetadataBuffer.GetData();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetMetadataContextMetadataBufferSize(MetadataContext const *ctx) {
  return ctx->MetadataBuffer.GetSize();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetMetadataContextMetadataBuffer(MetadataContext *ctx,
                                                           uint8_t const *data,
                                                           size_t const size) {
  ctx->MetadataBuffer.Reset(size);
  memcpy(ctx->MetadataBuffer.GetData(), data, size);
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetMetadataContextMetadataBufferSize(
    MetadataContext *ctx, size_t const size) {
  ctx->MetadataBuffer.Reset(size);
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE FrameContext *CreateFrameContext(void) {
  return new FrameContext;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void ReleaseFrameContext(FrameContext const *ctx) {
  delete ctx;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t GetFrameContextFrameIndex(FrameContext const *ctx) {
  return ctx->FrameIndex;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextFrameIndex(FrameContext *ctx,
                                                    size_t const frameIndex) {
  ctx->FrameIndex = frameIndex;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t GetFrameContextColumns(FrameContext const *ctx) {
  return ctx->Columns;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextColumns(FrameContext *ctx,
                                                 size_t const columns) {
  ctx->Columns = columns;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t GetFrameContextRows(FrameContext const *ctx) {
  return ctx->Rows;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextRows(FrameContext *ctx,
                                              size_t const rows) {
  ctx->Rows = rows;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetFrameContextBitsAllocated(FrameContext const *ctx) {
  return ctx->BitsAllocated;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextBitsAllocated(
    FrameContext *ctx, size_t const bitsAllocated) {
  ctx->BitsAllocated = bitsAllocated;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t GetFrameContextBitsStored(FrameContext const *ctx) {
  return ctx->BitsStored;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextBitsStored(FrameContext *ctx,
                                                    size_t const bitsStored) {
  ctx->BitsStored = bitsStored;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetFrameContextSamplesPerPixel(FrameContext const *ctx) {
  return ctx->SamplesPerPixel;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextSamplesPerPixel(
    FrameContext *ctx, size_t const samplesPerPixel) {
  ctx->SamplesPerPixel = samplesPerPixel;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetFrameContextPixelRepresentation(FrameContext const *ctx) {
  return ctx->PixelRepresentation;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextPixelRepresentation(
    FrameContext *ctx, size_t const pixelRepresentation) {
  ctx->PixelRepresentation = pixelRepresentation;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetFrameContextPlanarConfiguration(FrameContext const *ctx) {
  return ctx->PlanarConfiguration;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextPlanarConfiguration(
    FrameContext *ctx, size_t const planarConfiguration) {
  ctx->PlanarConfiguration = planarConfiguration;
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE char const *GetFrameContextPhotometricInterpretation(
    FrameContext const *ctx) {
  return ctx->PhotometricInterpretation.c_str();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextPhotometricInterpretation(
    FrameContext *ctx, char const *photometricInterpretation) {
  ctx->PhotometricInterpretation =
      photometricInterpretation ? photometricInterpretation : "";
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE uint8_t *GetFrameContextPixelDataBuffer(
    FrameContext const *ctx) {
  return ctx->PixelDataBuffer.GetData();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE size_t
GetFrameContextPixelDataBufferSize(FrameContext const *ctx) {
  return ctx->PixelDataBuffer.GetSize();
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextPixelDataBuffer(FrameContext *ctx,
                                                         uint8_t const *data,
                                                         size_t const size) {
  ctx->PixelDataBuffer.Reset(size);
  memcpy(ctx->PixelDataBuffer.GetData(), data, size);
}

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EMSCRIPTEN_KEEPALIVE void SetFrameContextPixelDataBufferSize(
    FrameContext *ctx, size_t const size) {
  ctx->PixelDataBuffer.Reset(size);
}
}
