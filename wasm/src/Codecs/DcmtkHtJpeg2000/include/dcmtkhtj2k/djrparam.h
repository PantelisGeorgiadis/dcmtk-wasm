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
 *  Purpose: representation parameters for JPEG 2000
 *
 */

#ifndef DCMTKHTJ2K_DJRPARAM_H
#define DCMTKHTJ2K_DJRPARAM_H

#include "dcmtk/config/osconfig.h"
#include "dcmtk/dcmdata/dcpixel.h" /* for class DcmRepresentationParameter */
#include "dldefine.h"

/** representation parameter for HT-J2K
 */
class DCMTKHTJ2K_EXPORT HtJ2kRepresentationParameter
    : public DcmRepresentationParameter {
 public:
  /** constructor
   *  @param losslessProcess true if lossless process is requested
   */
  HtJ2kRepresentationParameter(OFBool losslessProcess = OFTrue);

  /// copy constructor
  HtJ2kRepresentationParameter(HtJ2kRepresentationParameter const &arg);

  /// destructor
  virtual ~HtJ2kRepresentationParameter();

  /** this methods creates a copy of type DcmRepresentationParameter *
   *  it must be overwritten in every subclass.
   *  @return copy of this object
   */
  virtual DcmRepresentationParameter *clone() const;

  /** returns the class name as string.
   *  can be used in operator== as poor man's RTTI replacement.
   */
  virtual char const *className() const;

  /** compares an object to another DcmRepresentationParameter.
   *  Implementation must make sure that classes are comparable.
   *  @param arg representation parameter to compare with
   *  @return true if equal, false otherwise.
   */
  virtual OFBool operator==(DcmRepresentationParameter const &arg) const;

  /** returns true if lossless compression is desired
   *  @return true if lossless compression is desired
   */
  OFBool useLosslessProcess() const { return losslessProcess_; }

 private:
  /// true if lossless process should be used even in lossy transfer syntax
  OFBool losslessProcess_;
};

#endif
