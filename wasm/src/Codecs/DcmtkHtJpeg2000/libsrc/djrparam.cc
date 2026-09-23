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
 *  Purpose: representation parameter for JPEG-2000
 *
 */

#include "dcmtkhtj2k/djrparam.h"

#include "dcmtk/config/osconfig.h"
#include "dcmtk/ofstd/ofstd.h"

HtJ2kRepresentationParameter::HtJ2kRepresentationParameter(
    OFBool losslessProcess)
    : DcmRepresentationParameter(), losslessProcess_(losslessProcess) {}

HtJ2kRepresentationParameter::HtJ2kRepresentationParameter(
    HtJ2kRepresentationParameter const &arg)
    : DcmRepresentationParameter(arg), losslessProcess_(arg.losslessProcess_) {}

HtJ2kRepresentationParameter::~HtJ2kRepresentationParameter() {}

DcmRepresentationParameter *HtJ2kRepresentationParameter::clone() const {
  return new HtJ2kRepresentationParameter(*this);
}

char const *HtJ2kRepresentationParameter::className() const {
  return "HtJ2kRepresentationParameter";
}

OFBool HtJ2kRepresentationParameter::operator==(
    DcmRepresentationParameter const &arg) const {
  char const *argname = arg.className();
  if (argname) {
    OFString argstring(argname);
    if (argstring == className()) {
      HtJ2kRepresentationParameter const &argll =
          OFreinterpret_cast(HtJ2kRepresentationParameter const &, arg);
      if (losslessProcess_ && argll.losslessProcess_)
        return OFTrue;
      else if (losslessProcess_ != argll.losslessProcess_)
        return OFFalse;
      return OFTrue;
    }
  }
  return OFFalse;
}
