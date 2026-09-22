#include "Exception.h"

#include <emscripten.h>

#include <stdexcept>

using namespace std;

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EM_JS(void, onDcmtkException, (char const *message, size_t const len), {});

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
void ThrowDcmtkException(string const &message) {
  onDcmtkException(message.c_str(), message.length());

  throw runtime_error(message);
}
