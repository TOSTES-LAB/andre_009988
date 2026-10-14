/* Freestanding, source-owned static-analysis fixture. Never executed by QORVEX. */
volatile unsigned int qorvex_ppc_global = 7;
const char qorvex_ppc_marker[] = "qorvex-ppc-source-owned-fixture";

__attribute__((noinline)) unsigned int qorvex_ppc_leaf(unsigned int value)
{
    return value * 3u + qorvex_ppc_global;
}

__attribute__((noinline)) unsigned int qorvex_ppc_entry(unsigned int selector)
{
    unsigned int adjusted = selector > 10u ? selector : selector + 1u;
    return qorvex_ppc_leaf(adjusted) + (unsigned char)qorvex_ppc_marker[0];
}
