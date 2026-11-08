volatile int qorvex_project_global = 7;
__attribute__((noinline, used)) int qorvex_project_leaf(int x) {
  return x + qorvex_project_global;
}
__attribute__((noinline, used)) int qorvex_project_caller(int x) {
  return qorvex_project_leaf(x);
}
__attribute__((noinline, used)) int qorvex_project_other(int x) {
  return x - qorvex_project_global;
}
__attribute__((noinline, used)) int qorvex_project_callback(int (*fn)(int), int x) {
  return fn(x) + qorvex_project_global;
}
int main(void) { return qorvex_project_caller(qorvex_project_global); }
