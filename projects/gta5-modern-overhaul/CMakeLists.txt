cmake_minimum_required(VERSION 3.24)

project(VOXGTA5ModernOverhaul VERSION 0.0.1 LANGUAGES CXX)

option(VOX_BUILD_TESTS "Build standalone core tests" ON)
option(VOX_BUILD_RUNTIME "Build the Windows GTA V Enhanced ASI bootstrap" ON)
option(VOX_WARNINGS_AS_ERRORS "Treat compiler warnings as errors" OFF)

function(vox_apply_warnings target)
    if(MSVC)
        target_compile_options(${target} PRIVATE /W4 /permissive- /EHsc)
        if(VOX_WARNINGS_AS_ERRORS)
            target_compile_options(${target} PRIVATE /WX)
        endif()
    else()
        target_compile_options(${target} PRIVATE -Wall -Wextra -Wpedantic)
        if(VOX_WARNINGS_AS_ERRORS)
            target_compile_options(${target} PRIVATE -Werror)
        endif()
    endif()
endfunction()

add_library(vox_core STATIC
    src/core/src/Config.cpp
    src/core/src/GameInstall.cpp
    src/core/src/Logger.cpp
)

target_include_directories(vox_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/src/core/include
)

target_compile_features(vox_core PUBLIC cxx_std_20)
vox_apply_warnings(vox_core)

if(WIN32)
    add_library(vox_windows_platform STATIC
        src/platform/windows/WindowsFileVersion.cpp
    )

    target_include_directories(vox_windows_platform
        PUBLIC
            ${CMAKE_CURRENT_SOURCE_DIR}/src/platform/include
    )

    target_compile_features(vox_windows_platform PUBLIC cxx_std_20)
    target_link_libraries(vox_windows_platform PRIVATE Version)
    vox_apply_warnings(vox_windows_platform)

    if(VOX_BUILD_RUNTIME)
        add_library(vox_modern_overhaul_asi SHARED
            src/runtime/windows/Bootstrap.cpp
        )

        target_link_libraries(vox_modern_overhaul_asi
            PRIVATE
                vox_core
                vox_windows_platform
        )
        target_compile_features(vox_modern_overhaul_asi PRIVATE cxx_std_20)
        vox_apply_warnings(vox_modern_overhaul_asi)

        set_target_properties(vox_modern_overhaul_asi PROPERTIES
            OUTPUT_NAME "VOXModernOverhaul"
            PREFIX ""
            SUFFIX ".asi"
        )

        add_executable(vox_runtime_smoke_host
            tests/runtime/BootstrapSmokeHost.cpp
        )
        target_compile_features(vox_runtime_smoke_host PRIVATE cxx_std_20)
        vox_apply_warnings(vox_runtime_smoke_host)
        set_target_properties(vox_runtime_smoke_host PROPERTIES
            OUTPUT_NAME "gta5_enhanced"
        )
    endif()
endif()

if(VOX_BUILD_TESTS)
    enable_testing()

    add_executable(vox_core_tests
        tests/core_tests.cpp
    )

    target_link_libraries(vox_core_tests PRIVATE vox_core)
    if(WIN32)
        target_link_libraries(vox_core_tests PRIVATE vox_windows_platform)
    endif()

    target_compile_features(vox_core_tests PRIVATE cxx_std_20)
    vox_apply_warnings(vox_core_tests)

    add_test(NAME vox_core_tests COMMAND vox_core_tests)
endif()
