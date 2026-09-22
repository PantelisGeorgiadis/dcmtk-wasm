#pragma once
#include <cstdint>
#include <vector>

class DicomImage;

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
std::vector<uint8_t> WriteBmp(DicomImage &image, size_t const frame);
