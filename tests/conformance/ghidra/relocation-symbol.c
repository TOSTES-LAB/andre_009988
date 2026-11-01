/* Static ELF fixture: no target code is executed by the verifier. */
extern int qorvex_external(int);
int (*volatile qorvex_external_slot)(int) = qorvex_external;
__attribute__((visibility("hidden"), noinline, used)) int qorvex_local(int value) {
  return value + 1;
}
int (*volatile qorvex_local_slot)(int) = qorvex_local;
