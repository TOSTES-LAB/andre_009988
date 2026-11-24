/* Zifencei and Zicsr oracle for the soft- and single-float fixtures, and an F
 * oracle when the build has F, independent of the compiler's C code
 * generation. Returns its argument unchanged. */
.section .text
.option norvc
.global qorvex_riscv_isa_probe
.type qorvex_riscv_isa_probe, @function
qorvex_riscv_isa_probe:
    fence.i
    csrr t0, mcycle
#if defined(__riscv_flen)
    fmv.w.x ft0, a0
    fmv.x.w a0, ft0
#endif
    ret
.size qorvex_riscv_isa_probe, .-qorvex_riscv_isa_probe
