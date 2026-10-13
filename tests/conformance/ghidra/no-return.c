#include <stdlib.h>
#include <string.h>
#include <errno.h>

extern void *__tls_get_addr(void *);
extern int *__errno_location(void);
extern void qorvex_unknown_stop(void);
extern void _Unwind_Resume(void *) __attribute__((noreturn));
volatile unsigned long qorvex_after_call;

void *qorvex_malloc(size_t n) {
    void *p = malloc(n);
    qorvex_after_call++;
    return p;
}
void *qorvex_malloc_adjacent(size_t n) {
    void *p = malloc(n);
    qorvex_after_call++;
    return p;
}
__attribute__((visibility("hidden"))) void *qorvex_tls(void *p) {
    void *value = __tls_get_addr(p);
    qorvex_after_call++;
    return value;
}
__attribute__((visibility("hidden"))) void *qorvex_tls_chain(void *p) {
    void *value = qorvex_tls(p);
    qorvex_after_call++;
    return value;
}
void *qorvex_tls_outer(void *p) {
    void *value = qorvex_tls_chain(p);
    qorvex_after_call++;
    return value;
}
void *qorvex_memcpy(void *out, const void *in, size_t n) {
    void *value = memcpy(out, in, n);
    qorvex_after_call++;
    return value;
}
void *qorvex_memset(void *out, int c, size_t n) {
    void *value = memset(out, c, n);
    qorvex_after_call++;
    return value;
}
size_t qorvex_strlen(const char *p) {
    size_t value = strlen(p);
    qorvex_after_call++;
    return value;
}
int *qorvex_errno(void) {
    int *p = __errno_location();
    qorvex_after_call++;
    return p;
}
void qorvex_unknown(void) {
    qorvex_unknown_stop();
    qorvex_after_call++;
}
void qorvex_abort(void) { abort(); }
void qorvex_unwind(void *p) { _Unwind_Resume(p); }
void qorvex_local_stop(void) { __builtin_trap(); }
int qorvex_local_return(void) { return 1658; }
