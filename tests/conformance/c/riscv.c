/* Source-owned freestanding analysis fixture. Never execute this target. */
volatile unsigned int qorvex_riscv_global = 7;
extern unsigned int qorvex_riscv_probe(unsigned int value);

__attribute__((noinline)) unsigned int qorvex_riscv_leaf(unsigned int value)
{
    return value * 3u + qorvex_riscv_global;
}

__attribute__((noinline)) double qorvex_riscv_float(double left, double right)
{
    return left + right;
}

__attribute__((noinline)) unsigned int qorvex_riscv_entry(unsigned int selector)
{
    return qorvex_riscv_probe(qorvex_riscv_leaf(selector + 1u));
}
