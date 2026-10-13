typedef int (*qorvex_cross_callback)(int);

volatile int qorvex_cross_global = 7;
const volatile char qorvex_cross_message[] = "QORVEX_GHIDRA_CROSS_FORMAT";

__attribute__((noinline, used)) int qorvex_cross_leaf(int value) {
  return value + qorvex_cross_global + qorvex_cross_message[0] - 'R';
}

__attribute__((noinline, used)) int qorvex_cross_branch(int value) {
  /* A volatile-dependent loop keeps this callee multi-block at every
     optimization level: newer clang folds a symmetric if/else of tail calls
     into a conditional negate, and cross-format verification requires a
     recovered multi-block callee. */
  int adjusted = value > 10 ? value + 1 : -value;
  while (adjusted > 100) {
    adjusted -= qorvex_cross_global;
  }
  return qorvex_cross_leaf(adjusted);
}

__attribute__((noinline, used)) int qorvex_cross_indirect(
    qorvex_cross_callback callback, int value) {
  return callback(value);
}

#define QORVEX_CROSS_SWITCH_CASE(case_value) \
  case case_value:                        \
    return qorvex_cross_leaf(payload + case_value)

__attribute__((noinline, used)) int qorvex_cross_dense_switch(unsigned int selector,
                                                           int payload) {
  switch (selector) {
    QORVEX_CROSS_SWITCH_CASE(0);
    QORVEX_CROSS_SWITCH_CASE(1);
    QORVEX_CROSS_SWITCH_CASE(2);
    QORVEX_CROSS_SWITCH_CASE(3);
    QORVEX_CROSS_SWITCH_CASE(4);
    QORVEX_CROSS_SWITCH_CASE(5);
    QORVEX_CROSS_SWITCH_CASE(6);
    QORVEX_CROSS_SWITCH_CASE(7);
    QORVEX_CROSS_SWITCH_CASE(8);
    QORVEX_CROSS_SWITCH_CASE(9);
    QORVEX_CROSS_SWITCH_CASE(10);
    QORVEX_CROSS_SWITCH_CASE(11);
    QORVEX_CROSS_SWITCH_CASE(12);
    QORVEX_CROSS_SWITCH_CASE(13);
    QORVEX_CROSS_SWITCH_CASE(14);
    QORVEX_CROSS_SWITCH_CASE(15);
    QORVEX_CROSS_SWITCH_CASE(16);
    QORVEX_CROSS_SWITCH_CASE(17);
    QORVEX_CROSS_SWITCH_CASE(18);
    QORVEX_CROSS_SWITCH_CASE(19);
    QORVEX_CROSS_SWITCH_CASE(20);
    QORVEX_CROSS_SWITCH_CASE(21);
    QORVEX_CROSS_SWITCH_CASE(22);
    QORVEX_CROSS_SWITCH_CASE(23);
    QORVEX_CROSS_SWITCH_CASE(24);
    QORVEX_CROSS_SWITCH_CASE(25);
    QORVEX_CROSS_SWITCH_CASE(26);
    QORVEX_CROSS_SWITCH_CASE(27);
    QORVEX_CROSS_SWITCH_CASE(28);
    QORVEX_CROSS_SWITCH_CASE(29);
    QORVEX_CROSS_SWITCH_CASE(30);
    QORVEX_CROSS_SWITCH_CASE(31);
    QORVEX_CROSS_SWITCH_CASE(32);
    QORVEX_CROSS_SWITCH_CASE(33);
    QORVEX_CROSS_SWITCH_CASE(34);
    QORVEX_CROSS_SWITCH_CASE(35);
    QORVEX_CROSS_SWITCH_CASE(36);
    QORVEX_CROSS_SWITCH_CASE(37);
    QORVEX_CROSS_SWITCH_CASE(38);
    QORVEX_CROSS_SWITCH_CASE(39);
    default:
      return -1;
  }
}

#undef QORVEX_CROSS_SWITCH_CASE

__attribute__((noinline, used, visibility("default"))) int qorvex_cross_entry(void) {
  return qorvex_cross_branch(35) + qorvex_cross_indirect(qorvex_cross_leaf, 0);
}

__attribute__((used, visibility("default"))) void qorvex_cross_start(void) {
  volatile int result = qorvex_cross_entry();
  (void)result;
  for (;;) {
  }
}
