/*
 *
 *  Copyright 2015-2017 Ing-Long Eric Kuo
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 *
 *
 *  Module:  fmjpeg2k
 *
 *  Author:  Ing-Long Eric Kuo
 *
 *  Purpose: singleton class that registers decoders for all supported JPEG-2000 processes.
 *
 */

#include "dcmtkhtj2k/djdecode.h"

#include "dcmtk/config/osconfig.h"
#include "dcmtk/dcmdata/dccodec.h" /* for DcmCodecStruct */
#include "dcmtkhtj2k/djcodecd.h"
#include "dcmtkhtj2k/djcparam.h"

// initialization of static members
OFBool HtJ2kDecoderRegistration::registered_ = OFFalse;
HtJ2kCodecParameter *HtJ2kDecoderRegistration::cp_ = NULL;
HtJ2kDecoder *HtJ2kDecoderRegistration::decoder_ = NULL;

void HtJ2kDecoderRegistration::registerCodecs(
    HTJ2K_UIDCreation uidcreation, HTJ2K_PlanarConfiguration planarconfig,
    OFBool ignoreOffsetTable) {
  if (!registered_) {
    cp_ = new HtJ2kCodecParameter(uidcreation, planarconfig, ignoreOffsetTable);
    if (cp_) {
      decoder_ = new HtJ2kDecoder();
      if (decoder_) DcmCodecList::registerCodec(decoder_, NULL, cp_);

      registered_ = OFTrue;
    }
  }
}

void HtJ2kDecoderRegistration::cleanup() {
  if (registered_) {
    DcmCodecList::deregisterCodec(decoder_);
    delete decoder_;
    delete cp_;
    registered_ = OFFalse;
#ifdef DEBUG
    // not needed but useful for debugging purposes
    decoder_ = NULL;
    cp_ = NULL;
#endif
  }
}

OFString HtJ2kDecoderRegistration::getLibraryVersionString() {
  return DCMTKHTJ2K_VERSION_STRING;
}
