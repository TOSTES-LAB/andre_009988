#include <stdio.h>

volatile int qorvex_c_global = 7;

#define QORVEX_LONG_CHUNK "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
#define QORVEX_LONG_256 QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK QORVEX_LONG_CHUNK
#define QORVEX_LONG_1024 QORVEX_LONG_256 QORVEX_LONG_256 QORVEX_LONG_256 QORVEX_LONG_256
/* Keep the full-size literal even when a loader does not type it as a string. */
__attribute__((used)) const char qorvex_long_literal[] =
    "QORVEX_LONG_LITERAL_" QORVEX_LONG_1024 QORVEX_LONG_1024 QORVEX_LONG_1024 QORVEX_LONG_1024 "needle";
/* Verified Hopper loaders recognize this extent and split it into native objects. */
__attribute__((used)) const char qorvex_fragmented_literal[] =
    "QORVEX_FRAGMENTED_LITERAL_" QORVEX_LONG_256 QORVEX_LONG_256 "fragment_tail";
__attribute__((used)) const char qorvex_utf8_literal[] = "QORVEX_UTF8_é_😀";
__attribute__((used)) const char qorvex_ellipsis_literal[] = "QORVEX_LITERAL_…";
__attribute__((used)) const char qorvex_latin1_literal[] = "QORVEX_LATIN1_\xff";

__attribute__((noinline, used)) void qorvex_long_literal_procedure(void) {
  puts(qorvex_long_literal);
  puts(qorvex_fragmented_literal);
  puts(qorvex_utf8_literal);
  puts("QORVEX_ESCAPED_\"\\line\nend\t\r");
  puts("QORVEX_LITERAL_BACKSLASH_\\n");
  puts(qorvex_ellipsis_literal);
  puts(qorvex_latin1_literal);
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
