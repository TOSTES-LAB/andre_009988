#include <pspkernel.h>

PSP_MODULE_INFO("qorvex_psp_fixture", 0, 1, 0);
#ifndef QORVEX_PSP_GLOBAL
#define QORVEX_PSP_GLOBAL 7
#endif
volatile unsigned int qorvex_psp_global = QORVEX_PSP_GLOBAL;
const char qorvex_psp_marker[] = "qorvex-psp-source-owned-fixture";
unsigned int qorvex_psp_probe(void);

__attribute__((noinline)) unsigned int qorvex_psp_leaf(unsigned int value) {
  return value * 3u + qorvex_psp_global;
}
__attribute__((noinline)) unsigned int qorvex_psp_entry(unsigned int selector) {
  unsigned int adjusted = selector > 10u ? selector : selector + 1u;
  return qorvex_psp_leaf(adjusted) + qorvex_psp_probe();
}
int main(void) {
  return (int)qorvex_psp_entry(11u);
}
