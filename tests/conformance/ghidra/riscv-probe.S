/* Fixed instruction oracle, independent of the compiler's C code generation. */
.section .text
.option norvc
.global qorvex_riscv_probe
.type qorvex_riscv_probe, @function
qorvex_riscv_probe:
    addi a0, a0, 17
    ret
.size qorvex_riscv_probe, .-qorvex_riscv_probe
