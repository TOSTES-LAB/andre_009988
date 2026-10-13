#ifdef _WIN32
#define QORVEX_EXPORT __declspec(dllexport)
#define QORVEX_NOINLINE __declspec(noinline)
#else
#define QORVEX_EXPORT __attribute__((visibility("default")))
#define QORVEX_NOINLINE __attribute__((noinline))
#endif

QORVEX_EXPORT QORVEX_NOINLINE int qorvex_fixture_add(int left, int right) {
  return left + right + 7;
}

QORVEX_EXPORT QORVEX_NOINLINE int qorvex_fixture_subtract(int left, int right) {
  return left - right - 13;
}

int main(void) {
  return qorvex_fixture_add(11, 24) + qorvex_fixture_subtract(24, 11);
}
