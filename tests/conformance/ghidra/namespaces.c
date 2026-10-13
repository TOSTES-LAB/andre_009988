// Emit C++ ABI names with the host C compiler; no C++ runtime is required.
#if defined(__APPLE__)
#define QORVEX_CPP_SYMBOL(name) "_" name
#else
#define QORVEX_CPP_SYMBOL(name) name
#endif

volatile int qorvex_namespace_alpha_value
    __asm__(QORVEX_CPP_SYMBOL("_ZN5alpha5valueE")) = 3;
volatile int qorvex_namespace_nested_value
    __asm__(QORVEX_CPP_SYMBOL("_ZN5outer5inner5valueE")) = 1;

volatile int qorvex_duplicate_label_a = 3;
volatile int qorvex_duplicate_label_b = 4;

__attribute__((noinline, used)) int qorvex_duplicate_function_a(int value) {
  return value + 1;
}

__attribute__((noinline, used)) int qorvex_duplicate_function_b(int value) {
  return value + 2;
}

__attribute__((noinline, used)) int qorvex_namespace_alpha(int value)
    __asm__(QORVEX_CPP_SYMBOL("_ZN5alpha4sameEi"));
__attribute__((noinline, used)) int qorvex_namespace_beta(int value)
    __asm__(QORVEX_CPP_SYMBOL("_ZN4beta4sameEi"));
__attribute__((noinline, used)) int qorvex_namespace_nested(int value)
    __asm__(QORVEX_CPP_SYMBOL("_ZN5outer5inner4sameEi"));

int qorvex_namespace_alpha(int value) { return value + qorvex_namespace_alpha_value; }
int qorvex_namespace_beta(int value) { return value * 2; }
int qorvex_namespace_nested(int value) { return value - qorvex_namespace_nested_value; }

int main(void) {
  return qorvex_namespace_alpha(1) + qorvex_namespace_beta(2) +
         qorvex_namespace_nested(3);
}
