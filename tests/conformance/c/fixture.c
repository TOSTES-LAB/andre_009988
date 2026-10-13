#include <stdio.h>

volatile int qorvex_c_global = 7;

#define QORVEX_LONG_CHUNK "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#define QORVEX_LONG_256 QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK
#define QORVEX_LONG_1024 QORVEX_LONG_256 QORVEX_LONG_256 QORVEX_LONG_256 QORVEX_LONG_256
__attribute__((noinline, used)) void qorvex_long_literal_procedure(void) {
  puts("QORVEX_LONG_LITERAL_" QORVEX_LONG_1024 QORVEX_LONG_1024 QORVEX_LONG_1024 QORVEX_LONG_1024 "needle");
  puts("QORVEX_UTF8_é_😀");
  puts("QORVEX_ESCAPED_\"\\line\nend\t\r");
  puts("QORVEX_LITERAL_BACKSLASH_\\n");
  puts("QORVEX_LITERAL_…");
  puts("QORVEX_LATIN1_\xff");
}

__attribute__((noinline, used)) int qorvex_leaf(int value) {
  puts("QORVEX_C_LEAF");
  return value + qorvex_c_global;
}

__attribute__((noinline, used)) int qorvex_branch(int value) {
  return value > 3 ? qorvex_leaf(value) : qorvex_leaf(-value);
}

__attribute__((noinline, used)) int qorvex_entry(void) {
  puts("QORVEX_C_ENTRY");
  /* Give the native locals oracle explicit stack storage. */
  volatile int input = 5;
  return qorvex_branch(input);
}

int main(void) { return qorvex_entry() == 12 ? 0 : 1; }

__attribute__((noinline, used)) int qorvex_cycle_b(int value);

__attribute__((noinline, used)) int qorvex_cycle_a(int value) {
  return value > 0 ? qorvex_cycle_b(value - 1) : value;
}

__attribute__((noinline, used)) int qorvex_cycle_b(int value) {
  return value > 0 ? qorvex_cycle_a(value - 1) : value;
}
