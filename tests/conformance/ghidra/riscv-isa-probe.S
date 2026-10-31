/* Zifencei and Zicsr oracle for the soft-float fixture, independent of the
 * compiler's C code generation. Returns its argument unchanged. */
.section .text
.option norvc
.global qorvex_riscv_isa_probe
.type qorvex_riscv_isa_probe, @function
qorvex_riscv_isa_probe:
    fence.i
    csrr t0, mcycle
    ret
.size qorvex_riscv_isa_probe, .-qorvex_riscv_isa_probe
