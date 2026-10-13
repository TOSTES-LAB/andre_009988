/* Freestanding, source-owned static-analysis fixture. Never executed by QORVEX. */
volatile unsigned int qorvex_mips_global = 7;
const char qorvex_mips_marker[] = "qorvex-mips-source-owned-fixture";

__attribute__((noinline)) unsigned int qorvex_mips_leaf(unsigned int value)
{
    return value * 3u + qorvex_mips_global;
}

__attribute__((noinline)) unsigned int qorvex_mips_entry(unsigned int selector)
{
    unsigned int adjusted = selector > 10u ? selector : selector + 1u;
    return qorvex_mips_leaf(adjusted) + (unsigned char)qorvex_mips_marker[0];
}
