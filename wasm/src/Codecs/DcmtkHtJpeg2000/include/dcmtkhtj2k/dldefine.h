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
 *  Purpose: Contains preprocessor definitions
 *
 */

#ifndef DCMTKHTJ2KDEFINE_H
#define DCMTKHTJ2KDEFINE_H

#include "dcmtk/config/osconfig.h"
#include "dcmtk/ofstd/ofdefine.h"

#ifdef DCMTKHTJ2K_EXPORTS
#define DCMTKHTJ2K_EXPORT DCMTK_DECL_EXPORT
#else
#define DCMTKHTJ2K_EXPORT DCMTK_DECL_IMPORT
#endif

#endif
