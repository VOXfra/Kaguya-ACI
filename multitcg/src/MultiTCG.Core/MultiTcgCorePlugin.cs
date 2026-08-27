using BepInEx;
using BepInEx.Logging;
using HarmonyLib;
using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using UnityEngine;

namespace VOX.MultiTCG
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MultiTcgCorePlugin : BaseUnityPlugin
    {
        public const string PluginGuid = "fr.vox.multitcg.core";
        public const string PluginName = "MultiTCG Core";
        public const string PluginVersion = "0.1.0";

        internal static ManualLogSource Log;
        private Harmony _harmony;
        private bool _patched;

        private void Awake()
        {
            Log = Logger;
            Logger.LogInfo("MultiTCG Core 0.1.0 starting. Vanilla card data is never replaced by this plugin.");
        }

        private IEnumerator Start()
        {
            for (var frame = 0; frame < 600 && !_patched; frame++)
            {
                if (TryPatchEnhancedPrefabLoader())
                    yield break;
                yield return null;
            }

            if (!_patched)
                Logger.LogError("Enhanced Prefab Loader 6.x was not detected. MultiTCG content will not load.");
        }

        private bool TryPatchEnhancedPrefabLoader()
        {
            var bundleManagerType = AccessTools.TypeByName("EnhancedPrefabLoader.Core.BundleManager");
            var bundleHandleType = AccessTools.TypeByName("EnhancedPrefabLoader.Core.BundleManager+BundleHandle");
            var streamingType = AccessTools.TypeByName("EnhancedPrefabLoader.Core.Assets.StreamingAssetService");

            if (bundleManagerType == null || bundleHandleType == null || streamingType == null)
                return false;

            var getOrOpen = AccessTools.Method(bundleManagerType, "GetOrOpen");
            var waitForLoad = AccessTools.Method(bundleHandleType, "WaitForLoadAsync");
            var streamingLoad = AccessTools.Method(streamingType, "LoadAssetAsync");
            if (getOrOpen == null || waitForLoad == null || streamingLoad == null)
                return false;

            _harmony = new Harmony(PluginGuid);
            _harmony.Patch(getOrOpen, postfix: new HarmonyMethod(typeof(BundleRegistrationPatch), nameof(BundleRegistrationPatch.Postfix)));
            _harmony.Patch(waitForLoad, prefix: new HarmonyMethod(typeof(VirtualBundleWaitPatch), nameof(VirtualBundleWaitPatch.Prefix)));
            _harmony.Patch(streamingLoad, prefix: new HarmonyMethod(typeof(LooseAssetLoadPatch), nameof(LooseAssetLoadPatch.Prefix)));

            _patched = true;
            Logger.LogInfo("Enhanced Prefab Loader detected. MultiTCG additive expansion + loose artwork bridge enabled.");
            return true;
        }

        private void OnDestroy()
        {
            if (_patched)
                _harmony?.UnpatchSelf();
        }
    }

    internal static class VirtualBundleRegistry
    {
        private static readonly HashSet<object> Handles = new HashSet<object>();
        private static readonly Dictionary<object, string> Paths = new Dictionary<object, string>();

        internal static bool IsVirtualPath(string bundlePath)
        {
            if (string.IsNullOrWhiteSpace(bundlePath))
                return false;
            return File.Exists(bundlePath + ".multitcg");
        }

        internal static void Register(object handle, string bundlePath)
        {
            if (handle == null || !IsVirtualPath(bundlePath))
                return;
            Handles.Add(handle);
            Paths[handle] = bundlePath;
        }

        internal static bool IsVirtualHandle(object handle) => handle != null && Handles.Contains(handle);

        internal static string GetPath(object handle)
        {
            return handle != null && Paths.TryGetValue(handle, out var path) ? path : null;
        }
    }

    internal static class BundleRegistrationPatch
    {
        internal static void Postfix(string bundlePath, object __result)
        {
            if (!VirtualBundleRegistry.IsVirtualPath(bundlePath))
                return;
            VirtualBundleRegistry.Register(__result, bundlePath);
        }
    }

    internal static class VirtualBundleWaitPatch
    {
        internal static bool Prefix(object __instance, ref IEnumerator __result)
        {
            if (!VirtualBundleRegistry.IsVirtualHandle(__instance))
                return true;

            try
            {
                var type = __instance.GetType();
                var hasError = AccessTools.Property(type, "HasError");
                var isLoaded = AccessTools.Property(type, "IsLoaded");
                hasError?.SetValue(__instance, false, null);
                isLoaded?.SetValue(__instance, true, null);
                AccessTools.Field(type, "isLoading")?.SetValue(__instance, false);
                AccessTools.Field(type, "loadRequest")?.SetValue(__instance, null);
            }
            catch (Exception ex)
            {
                MultiTcgCorePlugin.Log?.LogError("Could not mark MultiTCG virtual bundle as loaded: " + ex);
            }

            __result = Empty();
            return false;
        }

        private static IEnumerator Empty()
        {
            yield break;
        }
    }

    internal static class LooseAssetLoadPatch
    {
        internal static bool Prefix(string bundlePath, string assetName, Type type, Action<UnityEngine.Object> callback, ref IEnumerator __result)
        {
            if (!VirtualBundleRegistry.IsVirtualPath(bundlePath))
                return true;

            __result = LooseAssetLoader.Load(bundlePath, assetName, type, callback);
            return false;
        }
    }

    internal static class LooseAssetLoader
    {
        private static readonly Dictionary<string, UnityEngine.Object> Cache = new Dictionary<string, UnityEngine.Object>(StringComparer.OrdinalIgnoreCase);

        internal static IEnumerator Load(string bundlePath, string assetName, Type requestedType, Action<UnityEngine.Object> callback)
        {
            UnityEngine.Object loaded = null;
            try
            {
                var filePath = ResolveAssetPath(bundlePath, assetName);
                if (filePath == null)
                {
                    MultiTcgCorePlugin.Log?.LogError($"MultiTCG loose asset not found: '{assetName}' for '{bundlePath}'.");
                    callback?.Invoke(null);
                    yield break;
                }

                var key = filePath + "|" + requestedType.FullName;
                if (Cache.TryGetValue(key, out loaded) && loaded != null)
                {
                    callback?.Invoke(loaded);
                    yield break;
                }

                var bytes = File.ReadAllBytes(filePath);
                var texture = new Texture2D(2, 2, TextureFormat.RGBA32, false);
                texture.name = Path.GetFileNameWithoutExtension(filePath);
                if (!ImageConversion.LoadImage(texture, bytes, false))
                {
                    UnityEngine.Object.Destroy(texture);
                    MultiTcgCorePlugin.Log?.LogError("Unity could not decode image: " + filePath);
                    callback?.Invoke(null);
                    yield break;
                }

                if (requestedType == typeof(Sprite) || typeof(Sprite).IsAssignableFrom(requestedType))
                {
                    var sprite = Sprite.Create(texture, new Rect(0f, 0f, texture.width, texture.height), new Vector2(0.5f, 0.5f), 100f);
                    sprite.name = texture.name;
                    loaded = sprite;
                }
                else if (requestedType == typeof(Texture) || requestedType == typeof(Texture2D) || typeof(Texture).IsAssignableFrom(requestedType))
                {
                    loaded = texture;
                }
                else
                {
                    UnityEngine.Object.Destroy(texture);
                    MultiTcgCorePlugin.Log?.LogError($"Unsupported loose asset type {requestedType.FullName} for {assetName}.");
                }

                if (loaded != null)
                    Cache[key] = loaded;
            }
            catch (Exception ex)
            {
                MultiTcgCorePlugin.Log?.LogError($"Failed loading loose MultiTCG asset '{assetName}': {ex}");
            }

            callback?.Invoke(loaded);
            yield break;
        }

        private static string ResolveAssetPath(string bundlePath, string assetName)
        {
            if (string.IsNullOrWhiteSpace(bundlePath) || string.IsNullOrWhiteSpace(assetName))
                return null;

            var root = Path.GetFullPath(Path.GetDirectoryName(bundlePath) ?? ".");
            var relative = assetName.Replace('/', Path.DirectorySeparatorChar).Replace('\\', Path.DirectorySeparatorChar);
            var candidates = new List<string>();
            if (Path.HasExtension(relative))
                candidates.Add(relative);
            else
            {
                candidates.Add(relative);
                candidates.Add(relative + ".png");
                candidates.Add(relative + ".jpg");
                candidates.Add(relative + ".jpeg");
            }

            foreach (var candidate in candidates)
            {
                var full = Path.GetFullPath(Path.Combine(root, candidate));
                if (!full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && !string.Equals(full, root, StringComparison.OrdinalIgnoreCase))
                    continue;
                if (File.Exists(full))
                    return full;
            }
            return null;
        }
    }
}
