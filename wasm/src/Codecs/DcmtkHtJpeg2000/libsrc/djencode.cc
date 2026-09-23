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
 *  Purpose: singleton class that registers encoders for all supported JPEG-2000 processes.
 *
 */

#include "dcmtkhtj2k/djencode.h"

#include "dcmtk/config/osconfig.h"
#include "dcmtk/dcmdata/dccodec.h" /* for DcmCodecStruct */
#include "dcmtkhtj2k/djcodece.h"
#include "dcmtkhtj2k/djcparam.h"

// initialization of static members
OFBool HtJ2kEncoderRegistration::registered_ = OFFalse;
HtJ2kCodecParameter *HtJ2kEncoderRegistration::cp_ = NULL;
HtJ2kLosslessEncoder *HtJ2kEncoderRegistration::losslessencoder_ = NULL;
HtJ2kRPCLLosslessEncoder *HtJ2kEncoderRegistration::rpcllosslessencoder_ = NULL;
HtJ2kLossyEncoder *HtJ2kEncoderRegistration::lossyencoder_ = NULL;

void HtJ2kEncoderRegistration::registerCodecs(
    OFBool jp2k_optionsEnabled, Uint16 jp2k_decompositions,
    Uint16 jp2k_cblkwidth, Uint16 jp2k_cblkheight,
    HTJ2K_ProgressionOrder jp2k_progressionOrder, OFBool preferCookedEncoding,
    Uint32 fragmentSize, OFBool createOffsetTable,
    HTJ2K_UIDCreation uidCreation, OFBool convertToSC) {
  if (!registered_) {
    cp_ = new HtJ2kCodecParameter(jp2k_optionsEnabled, jp2k_decompositions,
                                  jp2k_cblkwidth, jp2k_cblkheight,
                                  jp2k_progressionOrder, preferCookedEncoding,
                                  fragmentSize, createOffsetTable, uidCreation,
                                  convertToSC, EHTJ2KPC_restore, OFFalse);

    if (cp_) {
      losslessencoder_ = new HtJ2kLosslessEncoder();
      if (losslessencoder_)
        DcmCodecList::registerCodec(losslessencoder_, NULL, cp_);
      rpcllosslessencoder_ = new HtJ2kRPCLLosslessEncoder();
      if (rpcllosslessencoder_)
        DcmCodecList::registerCodec(rpcllosslessencoder_, NULL, cp_);
      lossyencoder_ = new HtJ2kLossyEncoder();
      if (lossyencoder_) DcmCodecList::registerCodec(lossyencoder_, NULL, cp_);
      registered_ = OFTrue;
    }
  }
}

void HtJ2kEncoderRegistration::cleanup() {
  if (registered_) {
    DcmCodecList::deregisterCodec(losslessencoder_);
    DcmCodecList::deregisterCodec(rpcllosslessencoder_);
    DcmCodecList::deregisterCodec(lossyencoder_);
    delete losslessencoder_;
    delete lossyencoder_;
    delete cp_;
    registered_ = OFFalse;
#ifdef DEBUG
    // not needed but useful for debugging purposes
    losslessencoder_ = NULL;
    rpcllosslessencoder_ = NULL;
    lossyencoder_ = NULL;
    cp_ = NULL;
#endif
  }
}

OFString HtJ2kEncoderRegistration::getLibraryVersionString() {
  return DCMTKHTJ2K_VERSION_STRING;
}
