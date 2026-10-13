/* Source-owned mixed-instruction shared-image control. */
.abicalls
.module fp=xx
.module nooddspreg
.text
.set noreorder
.set nomicromips
.set mips16
.globl qorvex_mips16_probe
.type qorvex_mips16_probe, @function
.ent qorvex_mips16_probe
qorvex_mips16_probe:
    li $2, 90
    xor $2, $4
    addiu $2, 7
    jrc $31
.end qorvex_mips16_probe
.size qorvex_mips16_probe, . - qorvex_mips16_probe
.ifndef QORVEX_MIPS_SYMBOL_RELATIVE
.hidden qorvex_mips16_probe
.endif

.set nomips16
.globl qorvex_mips32_probe
.type qorvex_mips32_probe, @function
.ent qorvex_mips32_probe
qorvex_mips32_probe:
    addiu $2, $4, 3
    jr $31
    nop
.end qorvex_mips32_probe
.size qorvex_mips32_probe, . - qorvex_mips32_probe

.data
.balign 4
.globl qorvex_mips16_pointer
.type qorvex_mips16_pointer, @object
.size qorvex_mips16_pointer, 4
qorvex_mips16_pointer:
    .word qorvex_mips16_probe
.section .note.GNU-stack, "", @progbits
