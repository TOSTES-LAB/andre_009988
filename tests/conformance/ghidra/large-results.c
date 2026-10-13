// A real initialized data range, with independently recognizable endpoints.
volatile unsigned char qorvex_large_payload[QORVEX_PAYLOAD_BYTES] = {
    [0] = 0x5a, [QORVEX_PAYLOAD_BYTES - 1] = 0xa5};

__attribute__((noinline, used)) int qorvex_large_entry(void) {
  return qorvex_large_payload[0] + qorvex_large_payload[QORVEX_PAYLOAD_BYTES - 1];
}

int main(void) { return qorvex_large_entry(); }
