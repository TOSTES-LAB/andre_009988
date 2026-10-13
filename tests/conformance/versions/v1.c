#include <stdio.h>
__attribute__((noinline, used)) int qorvex_version_leaf(void) {
  puts("QORVEX_VERSION_ONE");
  return 1;
}
__attribute__((noinline, used)) int qorvex_version_entry(void) {
  return qorvex_version_leaf();
}
int main(void) { return qorvex_version_entry() == 1 ? 0 : 1; }
