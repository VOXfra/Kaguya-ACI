# Incident — dev.10 real GTA crash and external crash-capture transition

Date: 2026-09-04

## Trigger

User tested `VOXModernOverhaul.asi` from `0.0.1-dev.10` in the real GTA V Enhanced installation and reported the game still crashes.

## User evidence

New logs supplied after the dev.10 launch:

- `asiloader(2).log`
  - Enhanced ASI loader build Mar 22 2025.
  - Loads `RageOpenV.asi`.
  - Loads `ScriptHookVDotNet.asi`.
  - Loads `TrainerV.asi`.
  - Loads `VOXModernOverhaul.asi` at `0x00007FF939220000`.
  - Reports `LOADER: Finished loading *.asi plugins`.
- `RageOpenV(2).log`
  - `[14:45:03.406][info] RageOpenV Inited!`
- `ScriptHookV(2).log`
  - ScriptHookV build Jul 15 2026, v3889.0/1158.13.
  - `INIT: Success, game version is VER_EN_1_0_1158_13`.
  - Registers ScriptHookVDotNet and TrainerV.

No supplied text log includes an exception code, faulting module, stack trace or crash offset.

## Why dev.10 changes the hypothesis boundary

The exact dev.10 package had already been independently inspected before this real test:

- custom no-CRT DLL entrypoint;
- `/NODEFAULTLIB`;
- no project core;
- no STL;
- no CRT/VCRUNTIME imports;
- no Win32 imports;
- no ScriptHookV calls;
- no GTA calls;
- no hooks;
- no filesystem/config/logging;
- no save/world mutation;
- Import Directory = 0;
- IAT = 0;
- TLS = 0;
- Load Configuration = 0;
- `.text` contains only the tiny success-return entry path.

Real crash persistence therefore rules out application/gameplay logic and CRT/default-library startup as credible primary explanations.

It does **not** yet prove the ASI itself is the faulting module because the existing logs only prove load order, not the exception source.

## Blocker protocol decision

Runtime/application development is frozen at this boundary.

Do not create dev.11/dev.12 application variants without new evidence.

Next discriminator:

1. keep all existing third-party plugins unchanged;
2. disable only `VOXModernOverhaul.asi` by renaming it to `.disabled`;
3. launch the same GTA V Enhanced environment as a control;
4. capture Windows crash evidence if the control fails;
5. if the control is stable, restore exact dev.10 and capture its crash;
6. identify exception/faulting module/offset before selecting the next technical approach.

## Crash Capture Pack implementation

Added `tools/crashcapture`:

- `Enable-CrashCapture.ps1`
- `Disable-CrashCapture.ps1`
- `Collect-CrashEvidence.ps1`
- `01_ENABLE_CRASH_CAPTURE.cmd`
- `02A_DISABLE_VOX_ASI.cmd`
- `02B_RESTORE_VOX_ASI.cmd`
- `03_COLLECT_EVIDENCE.cmd`
- `04_DISABLE_CRASH_CAPTURE.cmd`
- `README_CRASH_CAPTURE.txt`
- `VERSION.txt`

Added `tools/PackageCrashCapture.ps1` and dedicated workflow `.github/workflows/gta5-crashcapture.yml`.

### WER behavior

The enable script configures only:

`HKLM\SOFTWARE\Microsoft\Windows\Windows Error Reporting\LocalDumps\GTA5_Enhanced.exe`

Defaults:

- DumpType = 1 (minidump)
- DumpCount = 3
- DumpFolder = `%LOCALAPPDATA%\VOXModernOverhaul\CrashCapture\Dumps`

Before changing values, it records whether the key existed and backs up `DumpFolder`, `DumpCount`, `DumpType` and `CustomDumpFlags`. Restore refuses to modify registry state if that backup is missing.

### Collected evidence

Collector ZIP includes where available:

- recent Windows Application / Windows Error Reporting events;
- recent `.dmp` files;
- `asiloader.log`;
- `ScriptHookV.log`;
- `RageOpenV.log`;
- `ScriptHookVDotNet.log`;
- GTA executable file/product version and SHA-256;
- hashes/sizes/timestamps for relevant ASI/loader binaries;
- active WER per-app registry state.

## Tooling defects caught before delivery

### Failure 1 — run 33874964527

PowerShell syntax parse passed.

Evidence smoke test failed because:

`Compress-Archive -LiteralPath (Join-Path $WorkDir '*')`

uses a wildcard with `-LiteralPath`, which intentionally does not expand wildcards.

Fix:

- changed collector archive input to wildcard-capable `-Path`.

Regression result:

- next collector smoke test passed.

### Failure 2 — run 33875034785

Collector smoke test passed.

Packaging failed because:

`Copy-Item -LiteralPath (Join-Path $SourceDir '*')`

repeated the same wildcard/`-LiteralPath` category error.

Fix:

- changed package staging copy to wildcard-capable `-Path`.

## Final validation

Exact tooling commit: `226000bb45da0dfe4fc976617731a866b3466b18`.

GitHub Actions run: `33875088958`.

Results:

- PowerShell parse validation: PASS.
- Fake-GTA evidence collector smoke test: PASS.
- Crash-capture package build: PASS.
- Package extraction/content verification: PASS.
- Artifact upload: PASS.

Package:

`VOX-GTA5-Crash-Capture-0.0.1.zip`

SHA-256:

`30414e69d05283d8f326b289b38c87d372faf1e0d9588ad1604cabd4911ed27a`

GitHub Actions outer artifact digest:

`sha256:64297ab4e165f22d8bdebc29be17f196c96776c4f01bb9b97c0ea7a460db091b`

## Current unresolved question

Does the otherwise identical GTA V Enhanced installation remain stable when **only** `VOXModernOverhaul.asi` is disabled?

That baseline result is mandatory before the project selects the next loader/runtime approach.
