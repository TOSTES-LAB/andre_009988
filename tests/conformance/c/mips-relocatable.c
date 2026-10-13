/* Relocatable (ET_REL) static-analysis fixture, built with -c -G0 and never
 * executed or linked by QORVEX. It exercises the relocations Linux MIPS kernel
 * modules use: R_MIPS_26 calls, HI16/LO16 address pairs (one HI16 shared by
 * several LO16s, two HI16s resolved by one LO16, and a LO16 >= 0x8000 that
 * forces a HI16 carry), R_MIPS_32
 * data words, and undefined external code and data symbols. powf is an
 * external whose float prototype Ghidra's C library archive supplies by name,
 * so soft-float builds must give it the soft-float prototype too.
 */
extern int qorvex_mips_rel_external(int value);
extern int qorvex_mips_rel_external_data;
extern float powf(float base, float exponent);

struct qorvex_mips_rel_pair {
    int first;
    int second;
};

struct qorvex_mips_rel_pair qorvex_mips_rel_pair = { 0x1111, 0x2222 };
/* Places qorvex_mips_rel_carry past a signed 16-bit low-half boundary. */
char qorvex_mips_rel_padding[0x8000] = { 1 };
int qorvex_mips_rel_carry = 0x3333;
/* Referenced only by qorvex_mips_rel_highs, so its single LO16 stays unique. */
int qorvex_mips_rel_highs_target = 0x4444;
static const char qorvex_mips_rel_marker[] = "qorvex-mips-relocatable-fixture";

__attribute__((noinline)) int qorvex_mips_rel_leaf(int value)
{
    return value * 3 + qorvex_mips_rel_pair.first + qorvex_mips_rel_pair.second;
}

__attribute__((noinline, long_call)) int qorvex_mips_rel_far(int value);

int qorvex_mips_rel_far(int value)
{
    return value + qorvex_mips_rel_marker[value & 7] + qorvex_mips_rel_carry;
}

int (*const qorvex_mips_rel_table[])(int) = {
    qorvex_mips_rel_leaf,
    qorvex_mips_rel_far,
    qorvex_mips_rel_external,
};

__attribute__((noinline)) int qorvex_mips_rel_scaled(int value)
{
    float scaled = powf(1.5f, 2.5f);
    return value ^ *(int *)&scaled;
}

/* Most GCC-built kernel modules checked contain LO16s that resolve several
 * pending HI16s; Clang does not produce that from C. Two %hi and exactly one
 * %lo of a symbol nothing else references: any assembler that orders each
 * HI16 before a matching LO16 (GNU as, every LLVM version) must emit both
 * HI16s ahead of that single LO16, which therefore resolves both.
 */
__asm__(".text\n"
        ".globl qorvex_mips_rel_highs\n"
        ".type qorvex_mips_rel_highs, @function\n"
        ".set push\n"
        ".set noreorder\n"
        "qorvex_mips_rel_highs:\n"
        "    lui $2, %hi(qorvex_mips_rel_highs_target)\n"
        "    lui $3, %hi(qorvex_mips_rel_highs_target)\n"
        "    addiu $2, $2, %lo(qorvex_mips_rel_highs_target)\n"
        "    jr $31\n"
        "    move $3, $2\n"
        ".set pop\n"
        ".size qorvex_mips_rel_highs, .-qorvex_mips_rel_highs\n");

int qorvex_mips_rel_entry(int value)
{
    return qorvex_mips_rel_leaf(value) + qorvex_mips_rel_far(value) +
        qorvex_mips_rel_external(value) + qorvex_mips_rel_external_data +
        qorvex_mips_rel_table[value & 1](value) + qorvex_mips_rel_scaled(value);
}
