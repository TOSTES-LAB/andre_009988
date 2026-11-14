/* Source-owned Linux ELF fixture for the Ghidra loader-relocation boundary. */
typedef unsigned int qorvex_loader_word;

/* This file-backed value is the constant the unprotected decompiler may fold. */
__attribute__((used, visibility("default")))
const qorvex_loader_word qorvex_loader_value = 0x11111111u;

#if defined(__ELF__)
#define QORVEX_LOADER_POINTER_SECTION ".data.rel.ro"
#elif defined(__APPLE__)
#define QORVEX_LOADER_POINTER_SECTION "__DATA_CONST,__const"
#else
#error "The loader-relocation fixture requires an ELF or Mach-O compiler"
#endif

/* The loader fills this pointer before its RELRO block is sealed read-only. */
__attribute__((used, visibility("default"), section(QORVEX_LOADER_POINTER_SECTION)))
const qorvex_loader_word *volatile const qorvex_loader_pointer = &qorvex_loader_value;

/* A const object defined by the provider. In a PIE, GCC and the linker copy
 * it into RELRO with a copy relocation that Ghidra cannot apply, so the file
 * holds zero where the loader writes the provider's value: the #4177 shape. */
extern const qorvex_loader_word qorvex_external_const;

__attribute__((noinline, used, visibility("default")))
qorvex_loader_word qorvex_loader_reader(void) {
  return qorvex_external_const;
}

__attribute__((noinline, used, visibility("default")))
void qorvex_loader_writer(void) {
  *(volatile qorvex_loader_word *)(void *)&qorvex_external_const = 0;
}

/* An applied relocation in the same RELRO segment; it is not protected. */
__attribute__((noinline, used, visibility("default")))
qorvex_loader_word qorvex_loader_pointer_reader(void) {
  return *qorvex_loader_pointer;
}

extern qorvex_loader_word qorvex_external(int value);
/* Weak so -fPIE code reads it through a RELRO GOT entry. A strong reference
 * lets GCC use a copy relocation into writable .bss instead. */
extern qorvex_loader_word qorvex_external_value __attribute__((weak));

__attribute__((noinline, used, visibility("default")))
qorvex_loader_word qorvex_loader_got_caller(qorvex_loader_word value) {
  return qorvex_external((int)value) + qorvex_external_value;
}

__attribute__((used, visibility("default"))) void qorvex_loader_start(void) {
  volatile qorvex_loader_word result = qorvex_loader_reader();
  (void)result;
  for (;;) {
  }
}

#undef QORVEX_LOADER_POINTER_SECTION
