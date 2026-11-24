/*
 * Freestanding ESP-IDF flash layout probe for QORVEX's RISC-V lane. QORVEX never
 * runs it. tests/conformance/esp/esp32c6-shared-window.ld places .flash.text
 * where the NOBITS .flash_rodata_dummy reserves the same addresses, as
 * ESP-IDF does for ESP32-C6 and H4.
 */
#define QORVEX_FLASH __attribute__((section(".flash.text"), noinline))
#define QORVEX_IRAM __attribute__((section(".iram0.text"), noinline))

volatile int qorvex_riscv_esp_sink;
const int qorvex_riscv_esp_table[2] = {7, 9};

QORVEX_FLASH __attribute__((noreturn)) void qorvex_riscv_esp_restart(void) {
  for (;;) qorvex_riscv_esp_sink = 1;
}

QORVEX_FLASH int qorvex_riscv_esp_sum(int left, int right) {
  return left + right + qorvex_riscv_esp_table[1];
}

/* Ends with the no-return call, as ESP-IDF's app_main ends with esp_restart(). */
QORVEX_FLASH void qorvex_riscv_esp_main(void) {
  qorvex_riscv_esp_sink = qorvex_riscv_esp_sum(2, 3);
  qorvex_riscv_esp_restart();
}

/* Follows qorvex_riscv_esp_main; pseudocode that runs past the call shows 0x5a5a. */
QORVEX_FLASH void qorvex_riscv_esp_next(void) { qorvex_riscv_esp_sink = 0x5a5a; }

/* IRAM calls flash code through auipc+jalr, as ESP-IDF's startup does. */
QORVEX_IRAM void qorvex_riscv_esp_entry(void) {
  qorvex_riscv_esp_main();
}
