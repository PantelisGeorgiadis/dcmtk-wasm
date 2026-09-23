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
 *  Purpose: singleton class that registers encoders for all supported JPEG 2000
 * processes.
 *
 */

#ifndef DCMTKHTJ2K_DJENCODE_H
#define DCMTKHTJ2K_DJENCODE_H

#include "dcmtk/config/osconfig.h"
#include "dcmtk/dcmdata/dctypes.h" /* for Uint32 */
#include "dcmtk/ofstd/oftypes.h"   /* for OFBool */
#include "djcparam.h"              /* for class DJP2KCodecParameter */
#include "djutils.h"

class HtJ2kCodecParameter;
class HtJ2kLosslessEncoder;
class HtJ2kRPCLLosslessEncoder;
class HtJ2kLossyEncoder;

/** singleton class that registers encoders for all supported HT-J2K
 * processes.
 */
class DCMTKHTJ2K_EXPORT HtJ2kEncoderRegistration {
 public:
  /** registers encoders for all supported HT-J2K processes.
   *  If already registered, call is ignored unless cleanup() has
   *  been performed before.
   *  @param jp2k_optionsEnabled       enable/disable use of all five HT-J2K
   * parameters
   *  @param jp2k_decompositions       HT-J2K decomposition levels parameter
   *  @param jp2k_cblkwidth            HT-J2K codeblock width parameter
   *  @param jp2k_cblkheight           HT-J2K codeblock height parameter
   *  @param jp2k_progressionOrder     HT-J2K progression order to be used in
   * the HT-J2K codestream
   *  @param preferCookedEncoding      true if the "cooked" lossless encoder
   * should be preferred over the "raw" one
   *  @param fragmentSize              maximum fragment size (in kbytes) for
   * compression, 0 for unlimited.
   *  @param createOffsetTable         create offset table during image
   * compression
   *  @param uidCreation               mode for SOP Instance UID creation
   *  @param convertToSC               flag indicating whether image should be
   * converted to Secondary Capture upon compression
   *  @param jplsInterleaveMode        flag describing which interleave the
   * HT-J2K datastream should use
   */

  static void registerCodecs(
      OFBool jp2k_optionsEnabled = OFFalse, Uint16 jp2k_decompositions = 5,
      Uint16 jp2k_cblkwidth = 64, Uint16 jp2k_cblkheight = 64,
      HTJ2K_ProgressionOrder jp2k_progressionOrder = EHTJ2KPO_default,
      OFBool preferCookedEncoding = OFTrue, Uint32 fragmentSize = 0,
      OFBool createOffsetTable = OFTrue,
      HTJ2K_UIDCreation uidCreation = EHTJ2KUC_default,
      OFBool convertToSC = OFFalse);

  /** deregisters encoders.
   *  Attention: Must not be called while other threads might still use
   *  the registered codecs, e.g. because they are currently encoding
   *  DICOM data sets through dcmdata.
   */
  static void cleanup();

  /** get version information of the OpenJPH library.
   *  Typical output format: "OpenJPH, Revision 55020 (modified)"
   *  @return name and version number of the OpenJPH library
   */
  static OFString getLibraryVersionString();

 private:
  /// flag indicating whether the encoders are already registered.
  static OFBool registered_;

  /// pointer to codec parameter shared by all encoders
  static HtJ2kCodecParameter *cp_;

  /// pointer to encoder for lossless HT-J2K
  static HtJ2kLosslessEncoder *losslessencoder_;

  /// pointer to encoder for RPCL lossless HT-J2K
  static HtJ2kRPCLLosslessEncoder *rpcllosslessencoder_;

  /// pointer to encoder for lossy HT-J2K
  static HtJ2kLossyEncoder *lossyencoder_;
};

#endif
