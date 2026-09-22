#pragma once

#include "dcmtk/config/osconfig.h"
#include "dcmtk/dcmdata/dcistrmb.h"
#include "dcmtk/dcmdata/dcrledrg.h"
#include "dcmtk/dcmdata/dcrleerg.h"
#include "dcmtk/dcmimage/diregist.h"
#include "dcmtk/dcmjpeg/dipijpeg.h"
#include "dcmtk/dcmjpeg/djdecode.h"
#include "dcmtk/dcmjpeg/djencode.h"
#include "dcmtk/dcmjpls/djdecode.h"
#include "dcmtk/dcmjpls/djencode.h"
#include "dcmtkhtj2k/djdecode.h"
#include "dcmtkhtj2k/djencode.h"
#include "fmjpeg2k/djdecode.h"
#include "fmjpeg2k/djencode.h"

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
struct DcmtkCodecs {
  DcmtkCodecs() {
    // Register JPEG codecs
    DJDecoderRegistration::registerCodecs();
    DJEncoderRegistration::registerCodecs();
    // Register JPEGLS codecs
    DJLSDecoderRegistration::registerCodecs();
    DJLSEncoderRegistration::registerCodecs();
    // Register RLE codecs
    DcmRLEEncoderRegistration::registerCodecs();
    DcmRLEDecoderRegistration::registerCodecs();
    // Register J2K codecs
    FMJPEG2KEncoderRegistration::registerCodecs();
    FMJPEG2KDecoderRegistration::registerCodecs();
    // Register HTJ2K codecs
    HtJ2kEncoderRegistration::registerCodecs();
    HtJ2kDecoderRegistration::registerCodecs();
  }

  ~DcmtkCodecs() {
    // Deregister JPEG codecs
    DJDecoderRegistration::cleanup();
    DJEncoderRegistration::cleanup();
    // Deregister JPEGLS codecs
    DJLSDecoderRegistration::cleanup();
    DJLSEncoderRegistration::cleanup();
    // Deregister RLE codecs
    DcmRLEDecoderRegistration::cleanup();
    DcmRLEEncoderRegistration::cleanup();
    // Deregister HTJ2K codecs
    HtJ2kDecoderRegistration::cleanup();
    HtJ2kEncoderRegistration::cleanup();
    // Deregister J2K codecs
    FMJPEG2KDecoderRegistration::cleanup();
    FMJPEG2KEncoderRegistration::cleanup();
  }

  DcmtkCodecs(DcmtkCodecs const &) = delete;
  DcmtkCodecs &operator=(DcmtkCodecs const &) = delete;
};
