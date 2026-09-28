from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: apply_hotfix_v1471.py <module_linker.cpp>")

p = Path(sys.argv[1])
text = p.read_text(encoding="utf-8")
anchor = """ModuleLinker::acquire_activity(
    const std::string& module_identity) {

    error_.clear();
"""
replacement = """ModuleLinker::acquire_activity(
    const std::string& module_identity) {

    // Activity leases are part of guest execution, but acquisition still
    // touches the linker's diagnostic string. Serialize this short setup
    // section with ordinary linker mutations so concurrent guest batches do
    // not race on error_. The lease itself remains lock-free after return.
    std::lock_guard<std::recursive_mutex>
        mutation_lock(
            mutation_mutex_);

    error_.clear();
"""
count = text.count(anchor)
if count != 1:
    raise SystemExit(f"expected one acquire_activity anchor, got {count}")
text = text.replace(anchor, replacement)
p.write_text(text, encoding="utf-8", newline="\n")
print("V1471_ACTIVITY_HOTFIX_APPLIED")
