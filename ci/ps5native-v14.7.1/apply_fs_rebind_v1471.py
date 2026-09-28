from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit('usage: apply_fs_rebind_v1471.py <win64_guest_call_gate.cpp>')

p = Path(sys.argv[1])
t = p.read_text(encoding='utf-8')

def once(old: str, new: str, label: str):
    global t
    count = t.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 anchor, got {count}')
    t = t.replace(old, new, 1)

once(
'''thread_local GuestFaultRegisters
    g_last_guest_fault_registers{};

''',
'''thread_local GuestFaultRegisters
    g_last_guest_fault_registers{};

struct GuestFsRebindState {
    std::uint64_t expected_base{};
    std::uint32_t rebind_count{};
    bool armed{};
    GuestFsRebindState* previous{};
};

thread_local GuestFsRebindState*
    g_active_guest_fs_rebind = nullptr;

bool try_rebind_guest_fs_after_preemption(
    DWORD code) noexcept {

    auto* state =
        g_active_guest_fs_rebind;

    if (code != EXCEPTION_ACCESS_VIOLATION ||
        !state ||
        !state->armed ||
        state->expected_base == 0 ||
        state->rebind_count >= 1024) {

        return false;
    }

    __try {
        const auto observed =
            _readfsbase_u64();

        if (observed == state->expected_base) {
            return false;
        }

        _writefsbase_u64(
            state->expected_base);

        if (_readfsbase_u64() != state->expected_base) {
            return false;
        }

        ++state->rebind_count;
        return true;
    }
    __except(EXCEPTION_EXECUTE_HANDLER) {
        return false;
    }
}

''',
'thread-local FS recovery state')

once(
'''LONG CALLBACK guest_context_recovery_handler(
    EXCEPTION_POINTERS* info) {

    auto* state =
        g_active_context_recovery;

    if (!state ||
        !state->armed ||
        !info ||
        !info->ExceptionRecord ||
        !info->ContextRecord) {

        return EXCEPTION_CONTINUE_SEARCH;
    }

    const DWORD code =
        info->ExceptionRecord->
            ExceptionCode;

    if (!is_contained_guest_fault(code)) {
        return EXCEPTION_CONTINUE_SEARCH;
    }
''',
'''LONG CALLBACK guest_context_recovery_handler(
    EXCEPTION_POINTERS* info) {

    if (!info ||
        !info->ExceptionRecord ||
        !info->ContextRecord) {

        return EXCEPTION_CONTINUE_SEARCH;
    }

    const DWORD code =
        info->ExceptionRecord->
            ExceptionCode;

    if (try_rebind_guest_fs_after_preemption(code)) {
        return EXCEPTION_CONTINUE_EXECUTION;
    }

    auto* state =
        g_active_context_recovery;

    if (!state ||
        !state->armed ||
        !is_contained_guest_fault(code)) {

        return EXCEPTION_CONTINUE_SEARCH;
    }
''',
'vectored handler FS recovery')

filter_start = t.find('int guest_fault_filter(')
if filter_start < 0:
    raise SystemExit('guest_fault_filter missing')
old_filter = '''    const DWORD code =
        info->ExceptionRecord->ExceptionCode;

    if (!is_contained_guest_fault(code)) {
        return EXCEPTION_CONTINUE_SEARCH;
    }
'''
pos = t.find(old_filter, filter_start)
if pos < 0:
    raise SystemExit('guest_fault_filter code anchor missing')
new_filter = '''    const DWORD code =
        info->ExceptionRecord->ExceptionCode;

    if (try_rebind_guest_fs_after_preemption(code)) {
        return EXCEPTION_CONTINUE_EXECUTION;
    }

    if (!is_contained_guest_fault(code)) {
        return EXCEPTION_CONTINUE_SEARCH;
    }
'''
t = t[:pos] + t[pos:].replace(old_filter, new_filter, 1)

def patch_tls_call(function_name: str, has_existing_fault_reset: bool):
    global t
    start = t.find('bool Win64GuestCallGate::' + function_name)
    if start < 0:
        raise SystemExit(function_name + ': function missing')
    end = t.find('\nbool Win64GuestCallGate::', start + 10)
    if end < 0:
        end = len(t)
    sec = t[start:end]

    original_bind = '''    if (!write_fs_base_checked(
            static_cast<std::uint64_t>(
                tls_base))) {

        error =
            "failed to bind guest FS base";

        return false;
    }

'''
    if sec.count(original_bind) != 1:
        raise SystemExit(function_name + ': FS bind anchor mismatch')

    pre = '''    // Complete host TLS bookkeeping before FS is rebound. Windows may
    // restore the host FS base while the guest is preempted; the active
    // checkpoint lets the exception path repair only that lost binding.
    g_last_guest_fault_registers = {};

    GuestFsRebindState fs_rebind{};
    fs_rebind.expected_base =
        static_cast<std::uint64_t>(
            tls_base);
    fs_rebind.previous =
        g_active_guest_fs_rebind;
    fs_rebind.armed = true;
    g_active_guest_fs_rebind =
        &fs_rebind;

    if (!write_fs_base_checked(
            fs_rebind.expected_base)) {

        g_active_guest_fs_rebind =
            fs_rebind.previous;

        error =
            "failed to bind guest FS base";

        return false;
    }

'''
    sec = sec.replace(original_bind, pre, 1)

    if has_existing_fault_reset:
        reset = '''    g_last_guest_fault_registers = {};

'''
        first = sec.find(reset)
        second = sec.find(reset, first + len(reset))
        if second < 0:
            raise SystemExit(function_name + ': expected old fault reset missing')
        sec = sec[:second] + sec[second + len(reset):]

    invoke_end = '''                  &fault_code,
                  &exception_address);

'''
    if sec.count(invoke_end) != 1:
        raise SystemExit(function_name + ': dispatcher tail mismatch')
    sec = sec.replace(
        invoke_end,
        invoke_end + '''    fs_rebind.armed = false;
    g_active_guest_fs_rebind =
        fs_rebind.previous;

''',
        1)

    addr = '''            << reinterpret_cast<std::uintptr_t>(
                exception_address);'''
    if sec.count(addr) != 1:
        raise SystemExit(function_name + ': error address anchor mismatch')
    sec = sec.replace(
        addr,
        '''            << reinterpret_cast<std::uintptr_t>(
                exception_address)
            << " fs_rebinds="
            << std::dec
            << fs_rebind.rebind_count;''',
        1)

    t = t[:start] + sec + t[end:]

patch_tls_call('call_u64_noargs_with_tls_base', False)
patch_tls_call('call_u64_1arg_with_tls_base', True)

p.write_text(t, encoding='utf-8', newline='\n')
print('V1471_FS_PREEMPTION_RECOVERY_APPLIED')
