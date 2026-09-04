#pragma once

#include <stdint.h>

#if defined(_WIN32)
#define VOX_CDECL __cdecl
#else
#define VOX_CDECL
#endif

#ifdef __cplusplus
extern "C" {
#endif

enum {
    VOX_CORE_API_VERSION = 1u
};

typedef void(VOX_CDECL *VoxHostLogLineFn)(const char* line);

typedef struct VoxHostApi {
    uint32_t struct_size;
    uint32_t api_version;
    VoxHostLogLineFn log_line;
} VoxHostApi;

typedef uint32_t(VOX_CDECL *VoxCoreStartFn)(const VoxHostApi* host_api);
typedef void(VOX_CDECL *VoxCoreTickFn)(void);
typedef void(VOX_CDECL *VoxCoreStopFn)(void);

#ifdef __cplusplus
}
#endif
