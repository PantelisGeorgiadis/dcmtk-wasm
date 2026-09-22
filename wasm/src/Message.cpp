#include "Message.h"

#include <emscripten.h>

using namespace std;

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
EM_JS(void, onDcmtkMessage, (char const *message, size_t const len), {});

//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
//++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
void OutputDcmtkInfo(string const &message) {
  onDcmtkMessage(message.c_str(), message.length());
}
