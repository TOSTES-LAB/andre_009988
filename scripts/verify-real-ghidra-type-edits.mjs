#!/usr/bin/env node
import { sha256File } from "./lib/verifier-file-sha256.mjs";
import { createVerifierCommands } from "./lib/verify-commands.mjs";
import { createVerifierMcpOwner } from "./lib/verifier-mcp-owner.mjs";

import assert from "node:assert/strict";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  requireMcpOperationResult,
  requireMcpToolError,
} from "./lib/mcp-verifier-results.mjs";
import {
  createVerifierRun,
  completeVerifierRun,
  assertVerifierCleanupComplete,
} from "./lib/verifier-run.mjs";
import { VerifierFixture } from "./lib/verifier-fixture.mjs";
import { completeEvidenceClient } from "./lib/complete-evidence.mjs";

if (process.platform === "win32")
  throw new Error("Ghidra database edits currently support Linux/macOS only.");
const run = createVerifierRun();
// Ghidra children use the root as HOME and TMPDIR; a plain root admits them on every host.
const workspace = await VerifierFixture.open({
  prefix: "qorvex-ghidra-type-edits-",
  private: false,
});
const root = workspace.path;
const runtime = join(root, "runtime"),
  checkpointDirectory = join(root, "checkpoints");
const entrypoint = fileURLToPath(new URL("./qorvex.mjs", import.meta.url));
const sourcePath = join(root, "fixture.c"),
  target = join(root, "type-edit-fixture");
const opaqueSourcePath = join(root, "opaque.c"),
  opaqueTarget = join(root, "opaque-fixture");
const env = {
  ...process.env,
  HOME: root,
  XDG_CONFIG_HOME: join(root, "config"),
  XDG_CACHE_HOME: join(root, "cache"),
  XDG_DATA_HOME: join(root, "data"),
  TMPDIR: runtime,
  JDK_JAVA_OPTIONS: `-Duser.home=${root}`,
  QORVEX_ANALYSIS_PROVIDER: "ghidra",
  QORVEX_GHIDRA_CHECKPOINT_DIR: checkpointDirectory,
};
for (const name of [
  "QORVEX_GHIDRA_PROJECT_PATH",
  "QORVEX_GHIDRA_PROGRAM_NAME",
  "QORVEX_GHIDRA_SEED_FILE",
  "QORVEX_GHIDRA_NATIVEAOT_JAR",
  "QORVEX_GHIDRA_LANGUAGE_ID",
  "QORVEX_GHIDRA_COMPILER_SPEC_ID",
  "QORVEX_GHIDRA_DISABLED_ANALYZERS",
])
  delete env[name];
const commands = await createVerifierCommands();
const report = {
  verifier: "ghidra-signature-and-type-edits",
  phases: [],
  target: null,
};

async function phase(name, operation) {
  const start = performance.now();
  try {
    const facts = await operation();
    report.phases.push({
      name,
      status: "verified",
      elapsed_ms: Math.round(performance.now() - start),
      ...facts,
    });
  } catch (cause) {
    report.phases.push({
      name,
      status: "failed",
      elapsed_ms: Math.round(performance.now() - start),
    });
    throw cause;
  }
}
async function connect(environment = {}) {
  const owner = createVerifierMcpOwner();
  const client = completeEvidenceClient(
    new Client({ name: "qorvex-ghidra-type-edit-verifier", version: "1" }),
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entrypoint, "mcp"],
    env: { ...env, ...environment },
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});
  commands.adopt(owner, "type edit MCP connection");
  await owner.open(client, transport);
  const raw = (name, args = {}) =>
    client.callTool({ name, arguments: args }, { timeout: 240000 });
  return {
    raw,
    call: async (name, args = {}) =>
      requireMcpOperationResult(await raw(name, args), name),
    /** The refusal's single input issue and its recovery. */
    refused: async (name, args, field) => {
      const error = requireMcpToolError(await raw(name, args));
      assert.equal(error.code, "invalid_request");
      assert.deepEqual(
        error.details.issues.map((issue) => issue.path),
        [[field]],
      );
      return {
        message: error.details.issues[0].message,
        action: error.remediation.action,
      };
    },
    /** The refusal bound to the per-call length control of Ghidra's C parser. */
    overLimit: async (name, args, limit) => {
      const error = requireMcpToolError(await raw(name, args));
      assert.equal(error.code, "resource_constraint");
      assert.deepEqual(error.details.limit, {
        control_kind: "parameter",
        unit: "count",
        applies_at: "next_call",
        minimum: 16,
        ...limit,
      });
      assert.ok(error.message.includes(limit.parameter));
      assert.match(error.message, /Nothing in this call was applied/u);
    },
    /** The refusal of nesting over parenthesis_max_depth, measured over the whole text. */
    overNesting: async (name, args, required) => {
      const error = requireMcpToolError(await raw(name, args));
      assert.equal(error.code, "resource_constraint");
      const effective = args.parenthesis_max_depth ?? 8;
      assert.deepEqual(error.details.limit, {
        control_kind: "parameter",
        parameter: "parenthesis_max_depth",
        effective_value: effective,
        unit: "count",
        minimum: 1,
        maximum: 12,
        default_value: 8,
        applies_at: "next_call",
        required_value: required,
      });
      assert.match(
        error.message,
        new RegExp(`nests parentheses ${String(required)} levels deep`, "u"),
      );
    },
    close: () => owner.close(),
  };
}

// Without debug information a Mach-O symbol keeps its leading underscore,
// and the function's primary name may be another label at the entry.
const procedure =
  process.platform === "darwin" ? "_qorvex_session_total" : "qorvex_session_total";
const sessionType = "/qorvex_caller_defined/session";
const sessionDeclaration =
  "struct session { int id; char name[32]; unsigned flags; double score; struct session *next; };";
const signature = "double total(const struct session *s, unsigned mask)";
const pseudocode = async (session) =>
  await session.call("procedure_pseudo_code", {
    detail: "complete",
    procedure,
  });
const typeStatus = async (session, type) =>
  (await session.call("inspect_native_data_type", { type })).status;

try {
  await mkdir(runtime);
  await writeFile(
    sourcePath,
    `struct session { int id; char name[32]; unsigned flags; double score; struct session *next; };
__attribute__((noinline)) double qorvex_session_total(const struct session *s, unsigned mask) {
  double total = 0;
  for (; s; s = s->next) if (s->flags & mask) total += s->score;
  return total;
}
int main(void) { struct session one = { 1, "one", 16, 1.5, 0 }; return (int)qorvex_session_total(&one, 16); }
`,
  );
  // No debug information: Ghidra must not recover the structure on its own.
  // The macOS target is the object so the fixture needs no SDK link step.
  await commands.exec(
    "cc",
    [
      "-O1",
      "-g0",
      "-fno-inline",
      ...(process.platform === "darwin" ? ["-c"] : []),
      sourcePath,
      "-o",
      target,
    ],
    { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  // With DWARF, Ghidra imports the forward-declared struct as an empty
  // composite in the program's own archive: the type its parser fills in place.
  // An ELF object embeds its DWARF and needs no link step; Mach-O keeps it in a
  // separate dSYM, so macOS cross-compiles the object.
  await writeFile(
    opaqueSourcePath,
    "struct qorvex_opaque;\n__attribute__((noinline)) void *qorvex_keep(struct qorvex_opaque *o) { return o; }\n",
  );
  await commands.exec(
    "cc",
    [
      "-O1",
      "-g",
      "-c",
      ...(process.platform === "darwin"
        ? ["--target=x86_64-unknown-linux-gnu"]
        : []),
      opaqueSourcePath,
      "-o",
      opaqueTarget,
    ],
    { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 },
  );
  const targetDigest = await sha256File(target);
  report.target = {
    sha256: targetDigest,
    source: `self-built C fixture without debug information (${process.platform === "darwin" ? "object" : "executable"}); never executed`,
    host: process.platform,
    architecture: process.arch,
  };

  let before, baseline;
  const first = await connect();
  try {
    await first.call("open_binary", { path: target, provider_id: "ghidra" });
    await phase("analysis alone recovers no structure fields", async () => {
      before = await pseudocode(first);
      baseline = await first.call("procedure_info", { procedure });
      assert.doesNotMatch(before, /->(?:flags|score|next)/u);
      assert.equal(await typeStatus(first, sessionType), "unavailable");
      return {};
    });
    await phase(
      "a refused signature applies no name, comment or prototype",
      async () => {
        const rejected = {
          procedure,
          name: "qorvex_must_not_apply",
          comment: "must not apply",
        };
        const undefinedType = await first.refused(
          "annotate_native_function",
          { ...rejected, signature },
          "signature",
        );
        assert.match(undefinedType.message, /does not define: session/u);
        assert.match(undefinedType.action, /define_native_data_types/u);
        const syntax = await first.refused(
          "annotate_native_function",
          { ...rejected, signature: "double total(int a" },
          "signature",
        );
        assert.match(syntax.message, /line 1, column/u);
        // The prototype's own parentheses are one level, so this reaches nine.
        await first.overNesting(
          "annotate_native_function",
          {
            ...rejected,
            signature: `int total(int a[${"(".repeat(8)}1${")".repeat(8)}])`,
          },
          9,
        );
        // The required depth is the text's deepest, not the first over the bound.
        await first.overNesting(
          "annotate_native_function",
          {
            ...rejected,
            signature: `int total(int a[(((1)))], int b[${"(".repeat(10)}1${")".repeat(10)}])`,
            parenthesis_max_depth: 3,
          },
          11,
        );
        const long = `int total(int a /* ${"x".repeat(2040)} */)`;
        await first.overLimit(
          "annotate_native_function",
          { ...rejected, signature: long },
          {
            parameter: "signature_max_utf16",
            effective_value: 2048,
            maximum: 4096,
            default_value: 2048,
            required_value: long.length,
          },
        );
        // Parentheses inside comments are not nesting, and comments cannot hide it.
        await first.overNesting(
          "annotate_native_function",
          {
            ...rejected,
            signature: `int total(int a[${"( /*)*/".repeat(8)}1${")".repeat(8)}])`,
          },
          9,
        );
        // Each is accepted by Ghidra's parser and applied differently or not at all.
        for (const [refusedSignature, reason] of [
          ["double total(int a, int a)", /repeats parameter name a/u],
          // A K&R identifier list: Ghidra types each name undefined.
          [
            "double total(s, mask)",
            /signature names parameter s without a type/u,
          ],
          [
            "double total(int (*callback)(int))",
            /function-pointer declarator at line 1, column 19/u,
          ],
          [
            "double (*total)(int a)",
            /function-pointer declarator at line 1, column 9/u,
          ],
          ["double total(int a[4])", /applied a different prototype/u],
          [
            "void total(int a) __attribute__((noreturn))",
            /__attribute__ at line 1, column 19/u,
          ],
          [
            "__declspec(noreturn) void total(int a)",
            /__declspec at line 1, column 1/u,
          ],
          [
            "static double total(int a)",
            /specifier static at line 1, column 1/u,
          ],
          ["inline double total(int a)", /specifier inline/u],
          [
            "double total(register int a)",
            /specifier register at line 1, column 14/u,
          ],
          [
            "double total(int a) { return 1; }",
            /function body at line 1, column 21/u,
          ],
          [
            "double total(int a = 3)",
            /default argument or initializer at line 1, column 20/u,
          ],
          [
            "double total(int a); int y",
            /second declaration at line 1, column 22/u,
          ],
          ['double total(int a) __asm__("g")', /__asm__ at line 1, column 21/u],
          // Ghidra stores a native-width pointer for these and ignores the rest.
          [
            "double total(int * __ptr64 a)",
            /pointer-width qualifier __ptr64 \(Ghidra stores a native-width pointer\) at line 1, column 20/u,
          ],
          ["double total(int __far * a)", /pointer qualifier __far/u],
          [
            "__forceinline double total(int a)",
            /specifier __forceinline at line 1, column 1/u,
          ],
          [
            "[[noreturn]] double total(int a)",
            /\[\[\.\.\.\]\] attribute at line 1, column 1/u,
          ],
          ["double total(enum qorvex_missing a)", /does not define: qorvex_missing/u],
          ["#pragma pack(1)\ndouble total(int a)", /directive #pragma/u],
        ]) {
          const refusal = await first.refused(
            "annotate_native_function",
            { ...rejected, signature: refusedSignature },
            "signature",
          );
          assert.match(refusal.message, reason);
        }
        assert.equal(await pseudocode(first), before);
        const info = await first.call("procedure_info", { procedure });
        assert.equal(info.name, baseline.name);
        assert.equal(info.signature, baseline.signature);
        assert.equal(info.symbol.source, baseline.symbol.source);
        // The parser's invented placeholder for the undefined tag was not stored.
        assert.equal(await typeStatus(first, sessionType), "unavailable");
        assert.equal(await typeStatus(first, "/session"), "unavailable");
        return {};
      },
    );
    await phase(
      "definitions are stored together, read back and marked caller-defined",
      async () => {
        const defined = await first.call("define_native_data_types", {
          declarations: `${sessionDeclaration}\nenum mode { IDLE, BUSY = 5 }; typedef unsigned long count_t; union value { int i; float f; };`,
        });
        assert.deepEqual(
          defined.types.map(({ id, kind, status }) => [id, kind, status]),
          [
            ["/qorvex_caller_defined/count_t", "typedef", "defined"],
            ["/qorvex_caller_defined/mode", "enum", "defined"],
            [sessionType, "struct", "defined"],
            ["/qorvex_caller_defined/value", "union", "defined"],
          ],
        );
        assert.deepEqual(defined.effects, {
          scope: "session-analysis-database",
          source_bytes_modified: false,
        });
        const layout = await first.call("inspect_native_data_type", {
          type: sessionType,
        });
        assert.equal(layout.source, "caller-defined");
        assert.equal(layout.size_bytes, 56);
        assert.deepEqual(
          layout.fields.map(({ name, offset_bytes }) => [name, offset_bytes]),
          [
            ["id", 0],
            ["name", 4],
            ["flags", 36],
            ["score", 40],
            ["next", 48],
          ],
        );
        assert.equal(
          (await first.call("inspect_native_data_type", { type: "/int" }))
            .source,
          "analysis-database",
        );
        const repeated = await first.call("define_native_data_types", {
          declarations: sessionDeclaration,
        });
        assert.deepEqual(
          repeated.types.map(({ status }) => status),
          ["unchanged"],
        );
        // Constructs the parser applies are proven by the stored layout.
        const applied = await first.call("define_native_data_types", {
          declarations: `/* comments are skipped */
#pragma pack(push, 1) // wire layout
struct qorvex_packed { char a; int b; };
#pragma /* restore */ pack(pop)
struct qorvex_natural { char a; int b; }; // after pop
struct qorvex_flexible { int n; char data[]; };
struct qorvex_bits { unsigned low:3; unsigned high:5; };
typedef struct qorvex_node { struct qorvex_node *next; const int v; } qorvex_node, *qorvex_node_ptr;
enum qorvex_flags { QORVEX_NONE, QORVEX_EIGHT = 8, QORVEX_MASK = 0x35, QORVEX_NEG = -2, QORVEX_NEXT };
typedef struct { volatile int k; } qorvex_unnamed_t;`,
        });
        assert.deepEqual(
          applied.types.map(({ name, kind, size_bytes }) => [
            name,
            kind,
            size_bytes,
          ]),
          [
            ["qorvex_bits", "struct", 4],
            ["qorvex_flags", "enum", 4],
            ["qorvex_flexible", "struct", 4],
            ["qorvex_natural", "struct", 8],
            ["qorvex_node", "struct", 16],
            ["qorvex_node_ptr", "typedef", 8],
            ["qorvex_packed", "struct", 5],
            ["qorvex_unnamed_t", "struct", 4],
          ],
        );
        // Both qualifiers' lines and columns in the declarations text above.
        assert.deepEqual(applied.dropped_qualifiers, [
          { qualifier: "const", line: 8, column: 50 },
          { qualifier: "volatile", line: 10, column: 18 },
        ]);
        const inspect = (name) =>
          first.call("inspect_native_data_type", {
            type: `/qorvex_caller_defined/${name}`,
          });
        const packed = await inspect("qorvex_packed");
        assert.equal(packed.alignment_bytes, 1);
        // Ghidra's generic pointer has no pointed-to type; the dependency and
        // depth walks must skip that absent child rather than fail.
        const generic = await first.call("define_native_data_types", {
          declarations: "struct qorvex_generic { pointer p; int x; };",
        });
        assert.deepEqual(
          generic.types.map(({ name, size_bytes }) => [name, size_bytes]),
          [["qorvex_generic", 16]],
        );
        assert.deepEqual(
          (await inspect("qorvex_generic")).fields.map(({ name, type_id }) => [
            name,
            type_id,
          ]),
          [
            ["p", "/pointer"],
            ["x", "/int"],
          ],
        );
        // Pure qualifiers are reported; a labelled pack push and pop applies.
        const qualified = `struct qorvex_quals { int __w64 a; int __unaligned *b; int * __restrict c; };
#pragma pack(push, qorvex, 1)
struct qorvex_labeled { char c; int i; };
#pragma pack(pop, qorvex)
struct qorvex_after { char c; int i; };`;
        const quals = await first.call("define_native_data_types", {
          declarations: qualified,
        });
        assert.deepEqual(
          quals.types.map(({ name, size_bytes }) => [name, size_bytes]),
          [
            ["qorvex_after", 8],
            ["qorvex_labeled", 5],
            ["qorvex_quals", 24],
          ],
        );
        assert.deepEqual(
          quals.dropped_qualifiers,
          ["__w64", "__unaligned", "__restrict"].map((spelling) => ({
            qualifier: spelling === "__restrict" ? "restrict" : spelling,
            line: 1,
            column: qualified.indexOf(spelling) + 1,
          })),
        );
        assert.deepEqual(
          packed.fields.map(({ name, offset_bytes }) => [name, offset_bytes]),
          [
            ["a", 0],
            ["b", 1],
          ],
        );
        assert.deepEqual(
          (await inspect("qorvex_natural")).fields.map(
            ({ offset_bytes }) => offset_bytes,
          ),
          [0, 4],
        );
        assert.deepEqual(
          (await inspect("qorvex_flexible")).fields.map(
            ({ name, offset_bytes, size_bytes, type_id }) => [
              name,
              offset_bytes,
              size_bytes,
              type_id,
            ],
          ),
          [
            ["n", 0, 4, "/int"],
            ["data", 4, 0, "/char[0]"],
          ],
        );
        assert.deepEqual(
          (await inspect("qorvex_bits")).fields.map(
            ({ name, bit_size, bit_offset }) => [name, bit_size, bit_offset],
          ),
          [
            ["low", 3, 0],
            ["high", 5, 3],
          ],
        );
        // Values implicit numbering cannot produce, each from one literal.
        assert.deepEqual((await inspect("qorvex_flags")).members, [
          { name: "QORVEX_EIGHT", value: "8" },
          { name: "QORVEX_MASK", value: "53" },
          { name: "QORVEX_NEG", value: "-2" },
          { name: "QORVEX_NEXT", value: "-1" },
          { name: "QORVEX_NONE", value: "0" },
        ]);
        assert.equal(
          (await inspect("qorvex_node_ptr")).referenced_type,
          "/qorvex_caller_defined/qorvex_node *",
        );
        // A // comment may end the text; Ghidra's lexer still needs a line break.
        const noted = await first.call("define_native_data_types", {
          declarations: "struct qorvex_noted { int x; }; // noted",
        });
        assert.deepEqual(
          noted.types.map(({ name, kind, size_bytes }) => [
            name,
            kind,
            size_bytes,
          ]),
          [["qorvex_noted", "struct", 4]],
        );
        const maxPack = await first.call("define_native_data_types", {
          declarations:
            "#pragma pack(2147483647)\nstruct qorvex_pack_max { char c; int i; };",
        });
        assert.deepEqual(
          maxPack.types.map(({ name, size_bytes }) => [name, size_bytes]),
          [["qorvex_pack_max", 8]],
        );
        return { types: defined.types.length + applied.types.length };
      },
    );
    await phase(
      "a conflicting or unsupported definition stores nothing",
      async () => {
        // A tag and a typedef share a Ghidra name only when they are one type.
        // A sibling in the same text must stay unstored with them.
        for (const declarations of [
          "struct qorvex_tag_alias { int x; }; typedef int qorvex_tag_alias; struct qorvex_tag_sibling { int y; };",
          "enum qorvex_enum_alias { QORVEX_A = 1 }; typedef int qorvex_enum_alias; struct qorvex_enum_sibling { int y; };",
        ]) {
          const error = requireMcpToolError(
            await first.raw("define_native_data_types", { declarations }),
          );
          assert.equal(error.code, "invalid_request");
          assert.equal(error.retryable, false);
          assert.equal(error.recovery, undefined);
          assert.deepEqual(
            error.details?.issues?.map((issue) => ({
              path: issue.path,
              reason: issue.reason,
            })),
            [{ path: ["declarations"], reason: "invalid_value" }],
          );
          assert.equal(
            error.details?.diagnostics?.remote_code,
            "conflicting_type_definitions",
          );
          assert.deepEqual(error.details?.related_operations, [
            "define_native_data_types",
          ]);
        }
        for (const name of [
          "qorvex_tag_alias",
          "qorvex_tag_sibling",
          "qorvex_enum_alias",
          "qorvex_enum_sibling",
        ])
          assert.equal(
            await typeStatus(first, `/qorvex_caller_defined/${name}`),
            "unavailable",
          );
        const conflict = await first.refused(
          "define_native_data_types",
          {
            declarations:
              "struct qorvex_sibling { int a; }; struct session { long other; };",
          },
          "declarations",
        );
        assert.match(conflict.message, /session/u);
        assert.match(conflict.action, /does not replace/u);
        assert.equal(
          await typeStatus(first, "/qorvex_caller_defined/qorvex_sibling"),
          "unavailable",
        );
        // A different layout under an existing caller-defined name stores nothing.
        const redefined = requireMcpToolError(
          await first.raw("define_native_data_types", {
            declarations: "struct session { long changed; };",
          }),
        );
        assert.equal(redefined.code, "invalid_request");
        assert.equal(redefined.retryable, false);
        assert.equal(
          redefined.details?.diagnostics?.remote_code,
          "data_type_conflict",
        );
        assert.deepEqual(
          redefined.details?.issues?.map((issue) => ({
            path: issue.path,
            reason: issue.reason,
          })),
          [{ path: ["declarations"], reason: "invalid_value" }],
        );
        const kept = await first.call("inspect_native_data_type", {
          type: sessionType,
        });
        assert.equal(kept.size_bytes, 56);
        assert.equal(kept.fields[0].name, "id");
        assert.equal(kept.fields[0].offset_bytes, 0);
        // Integer.parseInt rejects this operand and Ghidra would keep the previous packing.
        const overflow = requireMcpToolError(
          await first.raw("define_native_data_types", {
            declarations:
              "#pragma pack(2147483648)\nstruct qorvex_pack_overflow { char c; int i; };",
          }),
        );
        assert.equal(overflow.code, "invalid_request");
        assert.equal(overflow.retryable, false);
        assert.equal(
          overflow.details?.diagnostics?.remote_code,
          "invalid_type_declarations",
        );
        assert.deepEqual(
          overflow.details?.issues?.map((issue) => ({
            path: issue.path,
            reason: issue.reason,
          })),
          [{ path: ["declarations"], reason: "invalid_value" }],
        );
        assert.equal(
          await typeStatus(first, "/qorvex_caller_defined/qorvex_pack_overflow"),
          "unavailable",
        );
        const builtin = await first.refused(
          "define_native_data_types",
          { declarations: "struct qorvex_other { int a; }; typedef long uint;" },
          "declarations",
        );
        assert.match(builtin.message, /uint \(existing \/uint\)/u);
        // Each is accepted by Ghidra's parser and dropped or stored differently.
        // A definition admits a parenthesis only as a function pointer, ret (*name)(parameters).
        const parenthesized = await first.refused(
          "define_native_data_types",
          {
            declarations: `struct qorvex_kept { char ${"(".repeat(10)}x${")".repeat(10)}; };`,
          },
          "declarations",
        );
        assert.match(
          parenthesized.message,
          /a parenthesis .* at line 1, column 24/u,
        );
        for (const [declarations, reason] of [
          [
            "struct qorvex_user { struct qorvex_missing *p; };",
            /qorvex_missing without members/u,
          ],
          // Function-pointer forms Ghidra 12.2 stores differently from the text.
          [
            "struct qorvex_callbacks { int (*fn)(); };",
            /an empty parameter list \(Ghidra stores \(\) as \(void\).*at line 1, column 34/u,
          ],
          [
            "struct qorvex_callbacks { int (__stdcall *fn)(int); };",
            /calling convention __stdcall inside a function-pointer declarator .* at line 1, column 29/u,
          ],
          [
            "struct qorvex_callbacks { int (*fn)(int (*inner)(int)); };",
            /a parenthesis in a function-pointer parameter list .* at line 1, column 38/u,
          ],
          [
            "struct qorvex_callbacks { int (*fn)(a, b); };",
            /qorvex_callbacks\.fn names parameter a without a type/u,
          ],
          [
            "struct qorvex_callbacks { int (*fn)(int fd, int fd); };",
            /the function pointer qorvex_callbacks\.fn repeats parameter name fd/u,
          ],
          [
            "typedef int (*qorvex_callback)(long value, char value);",
            /the function pointer qorvex_callback\.target repeats parameter name value/u,
          ],
          [
            "struct qorvex_callbacks { _Noreturn void (*fn)(int); };",
            /_Noreturn \(Ghidra does not store it on a function-pointer type\) at line 1, column 24/u,
          ],
          [
            "typedef int qorvex_function(int);",
            /a parenthesis that does not open a function pointer .* at line 1, column 25/u,
          ],
          [
            "struct qorvex_nested { struct { int a; } inner; };",
            /unnamed or undeclared type/u,
          ],
          ["struct qorvex_broken { int a;", /C parser rejected declarations/u],
          [
            "int qorvex_variable;",
            /not a struct, union, enum or typedef definition \(int\) at line 1, column 1/u,
          ],
          [
            "struct qorvex_kept { int a; };\nint qorvex_tail = 5;",
            /\(int\) at line 2, column 1/u,
          ],
          [
            "struct qorvex_kept { int a; } qorvex_instance;",
            /variable or declarator \(qorvex_instance\) after the definition of qorvex_kept at line 1, column 28/u,
          ],
          [
            "struct qorvex_kept { int a; } *qorvex_pointer;",
            /variable or declarator \(\*\) after the definition of qorvex_kept/u,
          ],
          [
            "static struct qorvex_kept { int a; } qorvex_static;",
            /specifier static at line 1, column 1/u,
          ],
          ["extern struct qorvex_kept qorvex_extern;", /specifier extern/u],
          ["struct qorvex_kept qorvex_plain;", /variable declaration \(qorvex_plain\)/u],
          [
            "struct qorvex_kept { char a; int b; } __attribute__((packed));",
            /__attribute__ \(use #pragma pack for packing\) at line 1, column 36/u,
          ],
          [
            "struct __attribute__((packed)) qorvex_kept { char a; int b; };",
            /__attribute__/u,
          ],
          [
            "struct qorvex_kept { char a; int b __attribute__((aligned(16))); };",
            /__attribute__/u,
          ],
          [
            "struct qorvex_kept { char a; _Alignas(16) int b; };",
            /_Alignas .* at line 1, column 27/u,
          ],
          [
            "struct qorvex_kept { char a; __declspec(align(16)) int b; };",
            /__declspec/u,
          ],
          ["struct qorvex_kept { char a; } __packed;", /__packed/u],
          ["__extension__ struct qorvex_kept { int a; };", /__extension__/u],
          [
            "#pragma once\nstruct qorvex_kept { int a; };",
            /directive #pragma \(only #pragma pack is applied\) at line 1, column 1/u,
          ],
          ['#line 5 "x.h"\nstruct qorvex_kept { int a; };', /directive #line/u],
          [
            "#pragma pack(1) /* a\r\nb */\nstruct qorvex_kept { int a; };",
            /block comment that continues a directive onto another line at line 1, column 17/u,
          ],
          [
            "#pragma pack(push, (1))\nstruct qorvex_kept { int a; };",
            /#pragma pack with operands Ghidra ignores or reads differently/u,
          ],
          ["enum { QORVEX_A, QORVEX_B };", /unnamed enum/u],
          ["typedef enum { QORVEX_A } qorvex_enum_t;", /unnamed enum/u],
          // The audit of C.jj tokens Ghidra consumes without applying.
          [
            "struct qorvex_kept { int * __ptr32 p; };",
            /pointer-width qualifier __ptr32/u,
          ],
          [
            "struct qorvex_kept { int x; } packed;",
            /attribute or extension packed/u,
          ],
          [
            "struct [[deprecated]] qorvex_kept { int a; };",
            /\[\[\.\.\.\]\] attribute at line 1, column 8/u,
          ],
          [
            "@interface Foo\n@end\nstruct qorvex_kept { int a; };",
            /Objective-C @ directive \(Ghidra skips its text\) at line 1, column 1/u,
          ],
          [
            "__pragma(pack(1)) struct qorvex_kept { char c; int i; };",
            /pragma operator __pragma \(write #pragma pack instead\)/u,
          ],
          [
            "_Static_assert(1); struct qorvex_kept { int a; };",
            /static assertion _Static_assert/u,
          ],
          [
            "struct __readableTo(x) qorvex_kept { int a; };",
            /attribute or extension __readableTo/u,
          ],
          ["struct qorvex_kept { char c; \\\n int i; };", /backslash/u],
          ...[
            "#pragma pack(0x1)",
            "#pragma pack(010)",
            "#pragma pack(show)",
            "#pragma pack(pop, 1)",
          ].map((pragma) => [
            `${pragma}\nstruct qorvex_kept { char c; int i; };`,
            /#pragma pack with operands Ghidra ignores or reads differently \(.*\) at line 1, column 1/u,
          ]),
          [
            "# pragma pack(1)\nstruct qorvex_kept { char c; int i; };",
            /# separated from its directive name/u,
          ],
          // Enum values, array sizes and bit-field widths are one plain literal.
          [
            "enum qorvex_bad { FIRST = 1, MASK = FIRST << 4 };",
            /the constant expression token FIRST .*write the computed value.* at line 1, column 34/u,
          ],
          ...[
            ["struct qorvex_kept { char a[sizeof(int)]; };", "sizeof"],
            ["struct qorvex_kept { char a[(char)300]; };", "\\("],
            ["enum qorvex_bad { A = 65536 * 65536 };", "\\*"],
            ["enum qorvex_bad { A = 0b11 };", "0b11"],
            ["enum qorvex_bad { A = 1.5 };", "\\."],
            ["enum qorvex_bad { A = 1 ? 2 : 3 };", "\\?"],
            ["enum qorvex_bad { A = ~0U >> 1 };", "~"],
            ["enum qorvex_bad { A = 1 < 2 };", "<"],
            ["enum qorvex_bad { A = 16u };", "16u"],
            ["enum qorvex_bad { A = 07 };", "07"],
            ["struct qorvex_kept { unsigned a : 1 << 4; };", "<"],
          ].map(([declarations, token]) => [
            declarations,
            new RegExp(`the constant expression token ${token} `, "u"),
          ]),
          [
            "enum qorvex_bad { A = 0x80000000 };",
            /literal 0x80000000, outside int/u,
          ],
          [
            "enum qorvex_bad { A = 2147483647, B };",
            /enumerator B, whose implicit value leaves int/u,
          ],
          // Ghidra ignores a bare push, so pop would restore nothing.
          ...[
            "#pragma pack(push)\n#pragma pack(1)\nstruct qorvex_kept { char c; int i; };\n#pragma pack(pop)",
            "#pragma pack(pop)\nstruct qorvex_kept { char c; int i; };",
          ].map((declarations) => [
            declarations,
            /#pragma pack with operands Ghidra ignores or reads differently \(.*\) at line 1, column 1/u,
          ]),
          [
            "#pragma pack(push, qorvex, 1)\n#pragma pack(pop)\nstruct qorvex_kept { char c; int i; };",
            /#pragma pack with operands .* at line 2, column 1/u,
          ],
          // Ghidra invents an empty enum for an undefined tag.
          [
            "struct qorvex_user2 { enum qorvex_missing_e m; };",
            /enum qorvex_missing_e without members/u,
          ],
          ["enum qorvex_fwd;", /enum qorvex_fwd without members/u],
          [
            "enum qorvex_mode { QORVEX_BUSY = 1, QORVEX_BUSY = 2 };",
            /Ghidra's C parser reported declarations: duplicate enum value: qorvex_mode : QORVEX_BUSY : 2/u,
          ],
          [
            "struct { int a; };",
            /unnamed struct or union definition at line 1, column 8/u,
          ],
          [
            "struct qorvex_kept { char a['b']; };",
            /string or character literal at line 1, column 26/u,
          ],
          [
            'struct qorvex_kept { char a[sizeof("abc")]; };',
            /constant expression token sizeof/u,
          ],
          [
            "struct qorvex_kept { int f; int f; };",
            /qorvex_kept repeats member name f/u,
          ],
          ["struct qorvex_kept {};", /without members/u],
        ]) {
          const refusal = await first.refused(
            "define_native_data_types",
            { declarations },
            "declarations",
          );
          assert.match(refusal.message, reason);
        }
        const longDeclarations = `struct qorvex_kept { int a; /* ${"x".repeat(4096)} */ };`;
        await first.overLimit(
          "define_native_data_types",
          { declarations: longDeclarations },
          {
            parameter: "declarations_max_utf16",
            effective_value: 4096,
            maximum: 8192,
            default_value: 4096,
            required_value: longDeclarations.length,
          },
        );
        for (const name of [
          "qorvex_other",
          "qorvex_user",
          "qorvex_missing",
          "qorvex_callbacks",
          "qorvex_nested",
          "qorvex_kept",
          "qorvex_enum_t",
          "qorvex_mode",
          "qorvex_user2",
          "qorvex_missing_e",
          "qorvex_fwd",
          "qorvex_bad",
        ])
          assert.equal(
            await typeStatus(first, `/qorvex_caller_defined/${name}`),
            "unavailable",
          );
        assert.equal(
          (await first.call("inspect_native_data_type", { type: sessionType }))
            .size_bytes,
          56,
        );
        return {};
      },
    );
    await phase(
      "an applied signature is read back and changes the cached decompilation",
      async () => {
        const updated = await first.call("annotate_native_function", {
          procedure,
          comment: "caller-authored prototype",
          signature,
        });
        assert.deepEqual(updated.annotations, {
          address: updated.dossier.procedure.address,
          name: baseline.name,
          comment: "caller-authored prototype",
          inline_comment: null,
          // The prototype's own name, total, is not applied.
          signature: `double ${baseline.name}(session * s, uint mask)`,
          signature_source: "user_defined",
          calling_convention: updated.annotations.calling_convention,
        });
        // Ghidra has no const; the edit is applied and the qualifier reported.
        assert.deepEqual(updated.dropped_qualifiers, [
          { qualifier: "const", line: 1, column: 14, parameter_index: 0 },
        ]);
        // The function had no calling convention. The locked storage is the
        // default convention's, and that convention is recorded with it.
        const api = updated.dossier.native_api;
        assert.equal(api.signature_source, "user_defined");
        assert.notEqual(updated.annotations.calling_convention, "unknown");
        assert.equal(
          api.calling_convention,
          updated.annotations.calling_convention,
        );
        assert.deepEqual(
          api.parameters.map(({ name, storage }) => [name, storage]),
          process.arch === "arm64"
            ? [
                ["s", "x0:8"],
                ["mask", "w1:4"],
              ]
            : [
                ["s", "RDI:8"],
                ["mask", "ESI:4"],
              ],
        );
        assert.equal(
          api.return_type.storage,
          process.arch === "arm64" ? "d0:8" : "XMM0_Qa:8",
        );
        const after = await pseudocode(first);
        for (const field of ["s->flags", "s->score", "s->next"])
          assert.ok(after.includes(field), `pseudocode must use ${field}`);
        assert.doesNotMatch(after, /Unknown calling convention/u);
        assert.match(updated.dossier.pseudocode, /s->flags/u);
        // Readback is a valid signature edit and changes nothing.
        const replayed = await first.call("annotate_native_function", {
          procedure,
          signature: updated.annotations.signature,
        });
        assert.deepEqual(replayed.annotations, updated.annotations);
        assert.equal(replayed.dropped_qualifiers, undefined);
        // CR, CRLF and LF each end a line, and an unterminated prototype ending
        // in a line comment is terminated after that comment.
        const reflowed = await first.call("annotate_native_function", {
          procedure,
          signature:
            "double total(\r  const struct session *s,\r\n  unsigned mask)\n// edited",
        });
        assert.deepEqual(reflowed.annotations, updated.annotations);
        assert.deepEqual(reflowed.dropped_qualifiers, [
          { qualifier: "const", line: 2, column: 3, parameter_index: 0 },
        ]);
        // A terminated prototype may end in a // comment with no newline after it.
        const commented = await first.call("annotate_native_function", {
          procedure,
          signature: `${updated.annotations.signature}; // noted`,
        });
        assert.deepEqual(commented.annotations, updated.annotations);
        assert.equal(commented.dropped_qualifiers, undefined);
        return {};
      },
    );
    await first.call("close_binary");
  } finally {
    await first.close();
  }

  await phase(
    "checkpoint mode restores the types and prototype in a new process",
    async () => {
      const second = await connect();
      try {
        await second.call("open_binary", {
          path: target,
          provider_id: "ghidra",
        });
        const restored = await pseudocode(second);
        assert.doesNotMatch(restored, /Unknown calling convention/u);
        for (const field of ["s->flags", "s->score", "s->next"])
          assert.ok(
            restored.includes(field),
            `restored pseudocode must use ${field}`,
          );
        const layout = await second.call("inspect_native_data_type", {
          type: sessionType,
        });
        assert.equal(layout.status, "available");
        assert.equal(layout.source, "caller-defined");
        const repeated = await second.call("define_native_data_types", {
          declarations: sessionDeclaration,
        });
        assert.deepEqual(
          repeated.types.map(({ status }) => status),
          ["unchanged"],
        );
        await second.call("close_binary");
        return {};
      } finally {
        await second.close();
      }
    },
  );
  await phase(
    "per-call bounds reach the bridge and bound the parsed text",
    async () => {
      const bounded = await connect();
      try {
        await bounded.call("open_binary", {
          path: target,
          provider_id: "ghidra",
        });
        const over = `double total(struct session *s, unsigned mask /* ${"x".repeat(20)} */)`;
        await bounded.overLimit(
          "annotate_native_function",
          { procedure, signature: over, signature_max_utf16: 64 },
          {
            parameter: "signature_max_utf16",
            effective_value: 64,
            maximum: 4096,
            default_value: 2048,
            required_value: over.length,
          },
        );
        const declarations =
          "struct qorvex_bounded { int first; int second; int third; };";
        await bounded.overLimit(
          "define_native_data_types",
          { declarations, declarations_max_utf16: 48 },
          {
            parameter: "declarations_max_utf16",
            effective_value: 48,
            maximum: 8192,
            default_value: 4096,
            required_value: declarations.length,
          },
        );
        assert.equal(
          await typeStatus(bounded, "/qorvex_caller_defined/qorvex_bounded"),
          "unavailable",
        );
        // A prototype of exactly the admitted length, without the semicolon
        // the parser needs, is applied.
        const exact = "double total(struct session *s, unsigned mask)".replace(
          ")",
          `${" ".repeat(64 - 46)})`,
        );
        assert.equal(exact.length, 64);
        const fitted = await bounded.call("annotate_native_function", {
          procedure,
          signature: exact,
          signature_max_utf16: 64,
        });
        assert.equal(fitted.annotations.signature_source, "user_defined");
        assert.equal(fitted.dropped_qualifiers, undefined);
        // Text within the lowered bound is still applied.
        const within = await bounded.call("define_native_data_types", {
          declarations: "struct qorvex_small { int a[2]; };",
          declarations_max_utf16: 48,
        });
        assert.deepEqual(
          within.types.map(({ name, size_bytes }) => [name, size_bytes]),
          [["qorvex_small", 8]],
        );
        await bounded.call("close_binary");
        return {};
      } finally {
        await bounded.close();
      }
    },
  );
  await phase(
    "function-pointer members and typedefs are stored with their prototypes",
    async () => {
      const callbacks = await connect();
      try {
        await callbacks.call("open_binary", {
          path: target,
          provider_id: "ghidra",
        });
        const declarations =
          "typedef long (*qorvex_cb)(long value);\n" +
          "struct qorvex_ops { int (*open)(const char *path, int flags); void (*close)(int fd); " +
          "char *(*name)(void); int (*log)(const char *format, ...); int __cdecl (*conv)(int); " +
          "int (*table[4])(int); int (**indirect)(int); qorvex_cb cb; void (*take)(qorvex_cb inner); " +
          "int (*next)(struct qorvex_ops *self); char tail; };";
        const defined = await callbacks.call("define_native_data_types", {
          declarations,
        });
        assert.deepEqual(
          defined.types.map((type) => [type.id, type.kind, type.status]),
          [
            ["/qorvex_caller_defined/qorvex_cb", "typedef", "defined"],
            ["/qorvex_caller_defined/qorvex_ops", "struct", "defined"],
          ],
        );
        // Parameter qualifiers are reported as dropped, as elsewhere.
        assert.deepEqual(
          defined.dropped_qualifiers.map((item) => item.qualifier),
          ["const", "const"],
        );
        const inspect = (type) =>
          callbacks.call("inspect_native_data_type", { type });
        const ops = await inspect("/qorvex_caller_defined/qorvex_ops");
        // The fixture is built for the 64-bit host, so pointers are 8 bytes.
        assert.deepEqual(
          ops.fields.map((field) => [
            field.name,
            field.offset_bytes,
            field.size_bytes,
            field.type_id,
          ]),
          [
            ["open", 0, 8, "/qorvex_caller_defined/qorvex_ops.open *"],
            ["close", 8, 8, "/qorvex_caller_defined/qorvex_ops.close *"],
            ["name", 16, 8, "/qorvex_caller_defined/qorvex_ops.name *"],
            ["log", 24, 8, "/qorvex_caller_defined/qorvex_ops.log *"],
            ["conv", 32, 8, "/qorvex_caller_defined/qorvex_ops.conv *"],
            ["table", 40, 32, "/qorvex_caller_defined/qorvex_ops.table *[4]"],
            ["indirect", 72, 8, "/qorvex_caller_defined/qorvex_ops.indirect * *"],
            ["cb", 80, 8, "/qorvex_caller_defined/qorvex_cb"],
            ["take", 88, 8, "/qorvex_caller_defined/qorvex_ops.take *"],
            ["next", 96, 8, "/qorvex_caller_defined/qorvex_ops.next *"],
            ["tail", 104, 1, "/char"],
          ],
        );
        assert.equal(ops.size_bytes, 112);
        const prototype = async (type) => {
          const inspected = await inspect(type);
          assert.equal(inspected.kind, "function");
          assert.equal(inspected.source, "caller-defined");
          const { total_parameters, parameters_truncated, ...definition } =
            inspected.function_definition;
          assert.equal(total_parameters, definition.parameters.length);
          assert.equal(parameters_truncated, false);
          return definition;
        };
        const unnamed = (type) => ({ name: null, type });
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.open"), {
          return_type: "/int",
          parameters: [
            { name: "path", type: "/char *" },
            { name: "flags", type: "/int" },
          ],
          varargs: false,
          calling_convention: "unknown",
        });
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.name"), {
          return_type: "/char *",
          parameters: [],
          varargs: false,
          calling_convention: "unknown",
        });
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.log"), {
          return_type: "/int",
          parameters: [{ name: "format", type: "/char *" }],
          varargs: true,
          calling_convention: "unknown",
        });
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.conv"), {
          return_type: "/int",
          parameters: [unnamed("/int")],
          varargs: false,
          calling_convention: "__cdecl",
        });
        for (const member of ["table", "indirect"])
          assert.deepEqual(
            await prototype(`/qorvex_caller_defined/qorvex_ops.${member}`),
            {
              return_type: "/int",
              parameters: [unnamed("/int")],
              varargs: false,
              calling_convention: "unknown",
            },
          );
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.take"), {
          return_type: "/void",
          parameters: [{ name: "inner", type: "/qorvex_caller_defined/qorvex_cb" }],
          varargs: false,
          calling_convention: "unknown",
        });
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_ops.next"), {
          return_type: "/int",
          parameters: [{ name: "self", type: "/qorvex_caller_defined/qorvex_ops *" }],
          varargs: false,
          calling_convention: "unknown",
        });
        assert.equal(
          (await inspect("/qorvex_caller_defined/qorvex_cb")).referenced_type,
          "/qorvex_caller_defined/qorvex_cb.target *",
        );
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_cb.target"), {
          return_type: "/long",
          parameters: [{ name: "value", type: "/long" }],
          varargs: false,
          calling_convention: "unknown",
        });
        // The function types are named by declarator, so a repeat is idempotent
        // and a differing one is refused without changing anything.
        const repeated = await callbacks.call("define_native_data_types", {
          declarations,
        });
        assert.deepEqual(
          repeated.types.map((type) => type.status),
          ["unchanged", "unchanged"],
        );
        const changed = await callbacks.refused(
          "define_native_data_types",
          {
            declarations:
              "struct qorvex_ops { long (*open)(const char *path, int flags); };",
          },
          "declarations",
        );
        assert.match(changed.message, /qorvex_ops\.open/u);
        assert.equal(
          (await prototype("/qorvex_caller_defined/qorvex_ops.open")).return_type,
          "/int",
        );
        // Comma-separated function-pointer declarators share the return type
        // and a calling convention written before the first one.
        const separated = await callbacks.call("define_native_data_types", {
          declarations:
            "struct qorvex_pair { int __cdecl (*open)(int), (*close)(long fd), count; };\n" +
            "typedef char (*qorvex_read_cb)(int), (*qorvex_write_cb)(short);",
        });
        assert.deepEqual(
          separated.types.map((type) => [type.id, type.status]),
          [
            ["/qorvex_caller_defined/qorvex_pair", "defined"],
            ["/qorvex_caller_defined/qorvex_read_cb", "defined"],
            ["/qorvex_caller_defined/qorvex_write_cb", "defined"],
          ],
        );
        assert.deepEqual(
          (await inspect("/qorvex_caller_defined/qorvex_pair")).fields.map(
            (field) => [field.name, field.offset_bytes, field.type_id],
          ),
          [
            ["open", 0, "/qorvex_caller_defined/qorvex_pair.open *"],
            ["close", 8, "/qorvex_caller_defined/qorvex_pair.close *"],
            ["count", 16, "/int"],
          ],
        );
        assert.deepEqual(await prototype("/qorvex_caller_defined/qorvex_pair.open"), {
          return_type: "/int",
          parameters: [unnamed("/int")],
          varargs: false,
          calling_convention: "__cdecl",
        });
        assert.deepEqual(
          await prototype("/qorvex_caller_defined/qorvex_pair.close"),
          {
            return_type: "/int",
            parameters: [{ name: "fd", type: "/long" }],
            varargs: false,
            calling_convention: "__cdecl",
          },
        );
        assert.deepEqual(
          await prototype("/qorvex_caller_defined/qorvex_write_cb.target"),
          {
            return_type: "/char",
            parameters: [unnamed("/short")],
            varargs: false,
            calling_convention: "unknown",
          },
        );
        await callbacks.call("close_binary");
        return { function_pointer_members: ops.fields.length };
      } finally {
        await callbacks.close();
      }
    },
  );
  await phase(
    "caller floods within the length bounds are refused and the session survives",
    async () => {
      const flood = await connect();
      try {
        await flood.call("open_binary", {
          path: target,
          provider_id: "ghidra",
        });
        const kept = await flood.call("define_native_data_types", {
          declarations: "struct qorvex_survivor { int a; };",
        });
        assert.equal(kept.types[0].status, "defined");
        const max = 8192;
        const floods = [
          [
            "define_native_data_types",
            { declarations: "[".repeat(max), declarations_max_utf16: max },
          ],
          [
            "define_native_data_types",
            {
              declarations: `struct qorvex_flood { char ${"(".repeat(max - 30)}`,
              declarations_max_utf16: max,
            },
          ],
          [
            "define_native_data_types",
            {
              declarations: `struct qorvex_flood { int a${"[1]".repeat((max - 40) / 3)}; };`,
              declarations_max_utf16: max,
            },
          ],
          [
            "define_native_data_types",
            {
              declarations: `struct qorvex_flood { int ${"*".repeat(max - 40)} p; };`,
              declarations_max_utf16: max,
            },
          ],
          [
            "define_native_data_types",
            {
              // Each typedef adds a pointer level and a typedef level.
              declarations: Array.from(
                { length: 300 },
                (_, index) =>
                  `typedef ${index === 0 ? "int" : `t${String(index - 1)}`} *t${String(index)};`,
              ).join(""),
              declarations_max_utf16: max,
            },
          ],
          [
            "annotate_native_function",
            {
              procedure,
              signature: "[".repeat(4096),
              signature_max_utf16: 4096,
            },
          ],
          [
            "annotate_native_function",
            {
              procedure,
              signature: `int total(int ${"*".repeat(4000)} p)`,
              signature_max_utf16: 4096,
            },
          ],
          [
            "annotate_native_function",
            {
              procedure,
              signature: `int total(${"(".repeat(4000)}`,
              signature_max_utf16: 4096,
            },
          ],
        ];
        const outcomes = [];
        const errors = [];
        for (const [name, args] of floods) {
          // Each is refused with a typed result, never a lost connection.
          const error = requireMcpToolError(await flood.raw(name, args));
          outcomes.push(error.code);
          errors.push(error);
        }
        // The whole chain is measured: the struct, max - 40 pointers, then int.
        assert.match(
          errors[3].message,
          new RegExp(
            `defines qorvex_flood, chained ${String(max - 40 + 2)} levels deep .*, above the 256-level limit`,
            "u",
          ),
        );
        assert.equal(errors[3].details.refusal.kind, "fixed_ceiling");
        assert.match(
          errors[3].remediation.action,
          /only fewer nested pointer, array, typedef or member levels does/u,
        );
        // Pointer, array and typedef chains are refused before Ghidra walks them.
        assert.deepEqual(outcomes, [
          "invalid_request",
          "invalid_request",
          "resource_constraint",
          "resource_constraint",
          "resource_constraint",
          "invalid_request",
          "resource_constraint",
          "resource_constraint",
        ]);
        assert.equal(
          (
            await flood.call("inspect_native_data_type", {
              type: "/qorvex_caller_defined/qorvex_survivor",
            })
          ).status,
          "available",
        );
        // A held database lock would fail this close's checkpoint save.
        await flood.call("close_binary");
        return { flood_outcomes: outcomes };
      } finally {
        await flood.close();
      }
    },
  );
  await phase(
    "a refused definition leaves an existing empty composite unchanged",
    async () => {
      const opaque = await connect();
      try {
        await opaque.call("open_binary", {
          path: opaqueTarget,
          provider_id: "ghidra",
        });
        const placeholder = "/DWARF/_UNCATEGORIZED_/qorvex_opaque";
        const fields = async () => {
          const type = await opaque.call("inspect_native_data_type", {
            type: placeholder,
          });
          assert.equal(type.status, "available");
          return type.fields.length;
        };
        assert.equal(await fields(), 0);
        // Ghidra's parser fills this empty composite in place. The call refuses
        // that replacement, and the placeholder stays empty.
        const conflict = requireMcpToolError(
          await opaque.raw("define_native_data_types", {
            declarations: "struct qorvex_opaque { int x; };",
          }),
        );
        assert.equal(conflict.code, "invalid_request");
        assert.equal(conflict.retryable, false);
        assert.equal(
          conflict.details?.diagnostics?.remote_code,
          "data_type_conflict",
        );
        assert.deepEqual(
          conflict.details?.issues?.map((issue) => ({
            path: issue.path,
            reason: issue.reason,
          })),
          [{ path: ["declarations"], reason: "invalid_value" }],
        );
        assert.equal(await fields(), 0);
        // A parser diagnostic is refused, and the edit's rollback covers parsing.
        const diagnostic = await opaque.refused(
          "define_native_data_types",
          {
            declarations:
              "struct qorvex_opaque { int x; }; enum qorvex_mode { QORVEX_BUSY = 1, QORVEX_BUSY = 2 };",
          },
          "declarations",
        );
        assert.match(
          diagnostic.message,
          /duplicate enum value: qorvex_mode : QORVEX_BUSY : 2/u,
        );
        assert.equal(await fields(), 0);
        await opaque.call("close_binary");
        return {};
      } finally {
        await opaque.close();
      }
    },
  );
  assert.equal(await sha256File(target), targetDigest);
  assert.deepEqual(await readdir(runtime), []);
  report.status = "verified";
} catch (cause) {
  report.status = "failed";
  report.error = cause instanceof Error ? cause.stack : String(cause);
  process.exitCode = 1;
} finally {
  let cleanupVerified = false;
  try {
    await workspace.closeEarly([() => commands.close()]);
    report.run = await completeVerifierRun(run);
    assertVerifierCleanupComplete(report.run.process_lineage);
    cleanupVerified = true;
  } catch (cause) {
    report.cleanup_error = String(cause);
    report.retained_workspace = root;
    process.exitCode = 1;
  }
  if (cleanupVerified && report.status === "verified") {
    try {
      await workspace.release();
    } catch (cause) {
      report.cleanup_error = String(cause);
      report.retained_workspace = root;
      process.exitCode = 1;
    }
  } else if (report.retained_workspace === undefined) {
    report.retained_workspace = root;
  }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
}
