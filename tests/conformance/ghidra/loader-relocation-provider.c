typedef unsigned int qorvex_loader_word;

__attribute__((visibility("default")))
qorvex_loader_word qorvex_external(int value) {
  return (qorvex_loader_word)value + 3u;
}

__attribute__((visibility("default")))
qorvex_loader_word qorvex_external_value = 0x22222222u;

__attribute__((visibility("default")))
const qorvex_loader_word qorvex_external_const = 0x11111111u;
