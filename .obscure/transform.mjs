// Rebrands the upstream snapshot checked out in the current directory.
// Names come from env so this file carries none of them.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const { SRC_OWNER, SRC_NAME, NEW_NAME, DST_SLUG } = process.env;
if (!SRC_OWNER || !SRC_NAME || !NEW_NAME || !DST_SLUG) throw new Error("missing env");
const DST_OWNER = DST_SLUG.split("/")[0];

// License texts must keep their copyright lines (MIT condition). Submodules belong to others.
const KEEP = [/^LICENSE$/, /^licenses\//, /^THIRD_PARTY_NOTICES\.md$/, /^third_party\//, /^\.obscure\//, /^\.github\/workflows\/sync\.yml$/];
const DROP = [/^\.github\//, /^README_[^/]+\.md$/, /^CHANGELOG\.md$/];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A letter right after an escape like "\n" or "\0" still starts a word.
const word = (s) => new RegExp(`(?:(?<![\\p{L}\\p{N}])|(?<=\\\\[0nrt]))${esc(s)}(?![\\p{L}\\p{N}])`, "giu");
const slugRe = new RegExp(`${esc(SRC_OWNER)}/${esc(SRC_NAME)}`, "gi");
const ownerRe = word(SRC_OWNER);
const nameRe = word(SRC_NAME);
const caseLike = (m) =>
  m === m.toUpperCase() ? NEW_NAME.toUpperCase()
  : m[0] === m[0].toUpperCase() ? NEW_NAME[0].toUpperCase() + NEW_NAME.slice(1)
  : NEW_NAME;
const rebrand = (s) => s.replace(slugRe, DST_SLUG).replace(ownerRe, DST_OWNER).replace(nameRe, caseLike);

const rebrandLock = (text) => {
  const lock = JSON.parse(text);
  lock.name = rebrand(lock.name);
  if (lock.packages?.[""]) lock.packages[""] = JSON.parse(rebrand(JSON.stringify(lock.packages[""])));
  return JSON.stringify(lock, null, 2) + "\n";
};

const entries =execFileSync("git", ["ls-files", "-s", "-z"], { encoding: "utf8" })
  .split("\0").filter(Boolean)
  .map((l) => ({ mode: l.slice(0, 6), file: l.slice(l.indexOf("\t") + 1) }));

for (const { mode, file } of entries) {
  if (mode === "160000" || KEEP.some((r) => r.test(file))) continue;
  if (DROP.some((r) => r.test(file))) { fs.rmSync(file, { force: true }); continue; }

  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8000).includes(0)) {
    const text = buf.toString("utf8");
    // Lockfile holds base64 integrity hashes, so only its own package entry is touched.
    const out = file.endsWith("package-lock.json") ? rebrandLock(text) : rebrand(text);
    if (out !== text) fs.writeFileSync(file, out);
  }

  const to = rebrand(file);
  if (to !== file) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(file, to);
  }
}

fs.copyFileSync(".obscure/README.md", "README.md");
