cmake_minimum_required(VERSION 3.24)

project(VOXGTA5ModernOverhaul VERSION 0.0.1 LANGUAGES CXX)

option(VOX_BUILD_TESTS "Build standalone core tests" ON)

add_library(vox_core STATIC
    src/core/src/Logger.cpp
)

target_include_directories(vox_core
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/src/core/include
)

target_compile_features(vox_core PUBLIC cxx_std_20)

if(MSVC)
    target_compile_options(vox_core PRIVATE /W4 /permissive- /EHsc)
else()
    target_compile_options(vox_core PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(VOX_BUILD_TESTS)
    enable_testing()

    add_executable(vox_core_tests
        tests/core_tests.cpp
    )

    target_link_libraries(vox_core_tests PRIVATE vox_core)
    target_compile_features(vox_core_tests PRIVATE cxx_std_20)

    if(MSVC)
        target_compile_options(vox_core_tests PRIVATE /W4 /permissive- /EHsc)
    else()
        target_compile_options(vox_core_tests PRIVATE -Wall -Wextra -Wpedantic)
    endif()

    add_test(NAME vox_core_tests COMMAND vox_core_tests)
endif()
