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
 *  Purpose: singleton class that registers the decoder for all supported
 * JPEG-2000 processes.
 *
 */

#ifndef DCMTKHTJ2K_DJDECODE_H
#define DCMTKHTJ2K_DJDECODE_H

#include "dcmtk/config/osconfig.h"
#include "dcmtk/ofstd/oftypes.h" /* for OFBool */
#include "djutils.h"             /* for enums */

class HtJ2kCodecParameter;
class HtJ2kDecoder;

/** singleton class that registers decoders for all supported HT-J2K
 * processes.
 */
class DCMTKHTJ2K_EXPORT HtJ2kDecoderRegistration {
 public:
  /** registers decoder for all supported HT-J2K processes.
   *  If already registered, call is ignored unless cleanup() has
   *  been performed before.
   *  @param uidcreation flag indicating whether or not
   *    a new SOP Instance UID should be assigned upon decompression.
   *  @param planarconfig flag indicating how planar configuration
   *    of color images should be encoded upon decompression.
   *  @param ignoreOffsetTable flag indicating whether to ignore the offset
   * table when decompressing multiframe images
   */
  static void registerCodecs(
      HTJ2K_UIDCreation uidcreation = EHTJ2KUC_default,
      HTJ2K_PlanarConfiguration planarconfig = EHTJ2KPC_restore,
      OFBool ignoreOffsetTable = OFFalse);

  /** deregisters decoders.
   *  Attention: Must not be called while other threads might still use
   *  the registered codecs, e.g. because they are currently decoding
   *  DICOM data sets through dcmdata.
   */
  static void cleanup();

  /** get version information of the OpenJPH library.
   *  Typical output format: "OpenJPH, Revision 55020 (modified)"
   *  @return name and version number of the OpenJPH library
   */
  static OFString getLibraryVersionString();

 private:
  /// flag indicating whether the decoders are already registered.
  static OFBool registered_;

  /// pointer to codec parameter shared by all decoders
  static HtJ2kCodecParameter *cp_;

  /// pointer to decoder
  static HtJ2kDecoder *decoder_;
};

#endif
