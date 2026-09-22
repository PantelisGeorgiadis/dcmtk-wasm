#include "Bmp.h"

#include <dcmtk/dcmimgle/dcmimage.h>

#include <cstring>
#include <memory>

#include "Exception.h"

using namespace std;

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// Windows DIB (BMP) file layout, packed to match the on-disk BMP structure.
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
#define PACK_STRUCT(decl) decl __attribute__((__packed__))
PACK_STRUCT(struct BitmapFileHeader {
  unsigned short bfType;
  unsigned int bfSize;
  unsigned short bfReserved1;
  unsigned short bfReserved2;
  unsigned int bfOffBits;
});

PACK_STRUCT(struct BitmapInfoHeader {
  unsigned int biSize;
  int biWidth;
  int biHeight;
  unsigned short biPlanes;
  unsigned short biBitCount;
  unsigned int biCompression;
  unsigned int biSizeImage;
  int biXPelsPerMeter;
  int biYPelsPerMeter;
  unsigned int biClrUsed;
  unsigned int biClrImportant;
});
#undef PACK_STRUCT

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
vector<uint8_t> WriteBmp(DicomImage &image, size_t const frame) {
  auto const w = image.getWidth();
  auto const h = image.getHeight();
  auto const stride = static_cast<size_t>(((w * 3) + 3) & ~3u);
  auto const dibSize = stride * h;

  auto dibStorage = make_unique<uint8_t[]>(dibSize);
  void *rawDib = dibStorage.get();
  auto const buffSize =
      image.createWindowsDIB(rawDib, dibSize, frame, 24, 1, 1);
  if (buffSize == 0) {
    ThrowDcmtkException("WriteBmp::createWindowsDIB::" +
                        string(DicomImage::getString(image.getStatus())));
  }

  BitmapInfoHeader infoHeader;
  memset(&infoHeader, 0, sizeof(infoHeader));
  infoHeader.biSize = sizeof(infoHeader);
  infoHeader.biWidth = static_cast<int>(w);
  infoHeader.biHeight = static_cast<int>(h);
  infoHeader.biPlanes = 1;
  infoHeader.biBitCount = 24;
  infoHeader.biSizeImage = static_cast<unsigned int>(buffSize);

  BitmapFileHeader fileHeader;
  memset(&fileHeader, 0, sizeof(fileHeader));
  fileHeader.bfType = 0x4d42;
  fileHeader.bfOffBits = sizeof(infoHeader) + sizeof(fileHeader);
  fileHeader.bfSize = fileHeader.bfOffBits + infoHeader.biSizeImage;

  vector<uint8_t> output;
  output.reserve(fileHeader.bfSize);

  auto const fileHeaderBytes = reinterpret_cast<uint8_t const *>(&fileHeader);
  output.insert(output.end(), fileHeaderBytes,
                fileHeaderBytes + sizeof(fileHeader));

  auto const infoHeaderBytes = reinterpret_cast<uint8_t const *>(&infoHeader);
  output.insert(output.end(), infoHeaderBytes,
                infoHeaderBytes + sizeof(infoHeader));

  auto const pixelBytes = reinterpret_cast<uint8_t const *>(dibStorage.get());
  output.insert(output.end(), pixelBytes, pixelBytes + buffSize);

  return output;
}
