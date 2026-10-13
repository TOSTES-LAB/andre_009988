#include <stdio.h>
__attribute__((noinline, used)) int qorvex_version_leaf(void) {
  puts("QORVEX_VERSION_TWO");
  return 2;
}
__attribute__((noinline, used)) int qorvex_added(void) { return 40; }
__attribute__((noinline, used)) int qorvex_version_entry(void) {
  return qorvex_version_leaf() + qorvex_added();
}
int main(void) { return qorvex_version_entry() == 42 ? 0 : 1; }
