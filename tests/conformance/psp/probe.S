/* Source-owned Allegrex decoding probe. This fixture is never executed. */
.set noreorder
.text
.align 2
.globl qorvex_psp_probe
.type qorvex_psp_probe, @function
.ent qorvex_psp_probe
qorvex_psp_probe:
  addiu $v0, $zero, 0x1234
  bitrev $v0, $v0
  jr $ra
  nop
.end qorvex_psp_probe
.size qorvex_psp_probe, .-qorvex_psp_probe
