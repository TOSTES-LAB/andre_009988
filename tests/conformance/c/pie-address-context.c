__attribute__((noinline)) int qorvex_pie_add(int value) {
    return value + 7;
}

int qorvex_pie_entry(void) {
    return qorvex_pie_add(35);
}
