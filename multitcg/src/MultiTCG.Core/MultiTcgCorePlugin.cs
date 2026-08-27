using BepInEx;
using BepInEx.Logging;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEngine;

namespace VOX.MultiTCG
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MultiTcgCorePlugin : BaseUnityPlugin
    {
        public const string PluginGuid = "fr.vox.multitcg.core";
        public const string PluginName = "MultiTCG";
        public const string PluginVersion = "0.2.0";
        private const string PhoneAppId = "MultiTCG";

        internal static MultiTcgCorePlugin Instance;
        internal static ManualLogSource Log;

        private readonly Catalog _catalog = new Catalog();
        private readonly PlayerCollection _player = new PlayerCollection();
        private readonly Dictionary<string, string> _languageByTcg = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private Rect _window = new Rect(80f, 80f, 920f, 640f);
        private Vector2 _scroll;
        private bool _visible;
        private bool _phoneRegistered;
        private string _view = "home";
        private string _selectedTcg;
        private string _selectedSet;
        private string _status = "MultiTCG prêt.";
        private string _lastPack = string.Empty;
        private GUIStyle _titleStyle;
        private GUIStyle _mutedStyle;

        private string PluginRoot => Path.Combine(Paths.PluginPath, "MultiTCG");
        private string DataRoot => Path.Combine(PluginRoot, "Data");
        private string SavePath => Path.Combine(Application.persistentDataPath, "MultiTCG", "save_v2.txt");

        private void Awake()
        {
            Instance = this;
            Log = Logger;
            Directory.CreateDirectory(DataRoot);
            LoadCatalogs();
            LoadSave();
            Logger.LogInfo($"MultiTCG v{PluginVersion} loaded. No vanilla card data is patched or replaced.");
        }

        private IEnumerator Start()
        {
            for (var frame = 0; frame < 900 && !_phoneRegistered; frame++)
            {
                if (TryRegisterPhoneApp())
                    break;
                yield return null;
            }

            if (!_phoneRegistered)
            {
                Logger.LogWarning("Phone Overhaul API not detected. MultiTCG remains available with F8.");
                _status = "Phone Overhaul non détecté : F8 ouvre MultiTCG.";
            }
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.F8))
                ToggleVisible();
            if (_visible && Input.GetKeyDown(KeyCode.Escape))
                _visible = false;
        }

        private void OnGUI()
        {
            if (!_visible)
                return;

            EnsureStyles();
            var maxW = Mathf.Min(920f, Screen.width - 30f);
            var maxH = Mathf.Min(640f, Screen.height - 30f);
            _window.width = maxW;
            _window.height = maxH;
            _window.x = Mathf.Clamp(_window.x, 0f, Mathf.Max(0f, Screen.width - _window.width));
            _window.y = Mathf.Clamp(_window.y, 0f, Mathf.Max(0f, Screen.height - _window.height));
            _window = GUI.Window(817204, _window, DrawWindow, "MultiTCG");
        }

        private void DrawWindow(int id)
        {
            GUILayout.BeginVertical();
            GUILayout.BeginHorizontal();
            GUILayout.Label("MultiTCG", _titleStyle, GUILayout.ExpandWidth(true));
            if (GUILayout.Button("×", GUILayout.Width(36), GUILayout.Height(28)))
                _visible = false;
            GUILayout.EndHorizontal();

            GUILayout.BeginHorizontal();
            NavButton("Accueil", "home");
            NavButton("Boutique", "store");
            NavButton("Collections", "collection");
            NavButton("Langues", "languages");
            GUILayout.FlexibleSpace();
            GUILayout.EndHorizontal();

            GUILayout.Space(5);
            _scroll = GUILayout.BeginScrollView(_scroll, GUILayout.ExpandHeight(true));
            if (_catalog.Tcgs.Count == 0)
            {
                GUILayout.Label("Aucun catalogue MultiTCG trouvé.");
                GUILayout.Label("Place des fichiers .mtcg dans BepInEx/plugins/MultiTCG/Data.", _mutedStyle);
            }
            else if (_view == "store") DrawStore();
            else if (_view == "collection") DrawCollection();
            else if (_view == "languages") DrawLanguages();
            else if (_view == "set") DrawSet();
            else DrawHome();
            GUILayout.EndScrollView();

            GUILayout.Space(4);
            GUILayout.Label(_status, _mutedStyle);
            GUILayout.EndVertical();
            GUI.DragWindow(new Rect(0f, 0f, _window.width - 45f, 34f));
        }

        private void EnsureStyles()
        {
            if (_titleStyle != null)
                return;
            _titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 24, fontStyle = FontStyle.Bold };
            _mutedStyle = new GUIStyle(GUI.skin.label) { fontSize = 12, wordWrap = true };
            _mutedStyle.normal.textColor = new Color(0.72f, 0.72f, 0.72f, 1f);
        }

        private void NavButton(string label, string target)
        {
            GUI.enabled = _view != target;
            if (GUILayout.Button(label, GUILayout.Width(118), GUILayout.Height(30)))
            {
                _view = target;
                _scroll = Vector2.zero;
                _selectedSet = null;
            }
            GUI.enabled = true;
        }

        private void DrawHome()
        {
            GUILayout.Label("Tes TCG, dans la même boutique", _titleStyle);
            GUILayout.Label("Cette version n'altère aucune carte Tetramon. Les cartes et boosters MultiTCG vivent dans une sauvegarde séparée et l'application s'intègre à Phone Overhaul quand il est présent.", _mutedStyle);
            GUILayout.Space(10);

            foreach (var tcg in _catalog.Tcgs)
            {
                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.Label(tcg.Name, new GUIStyle(GUI.skin.label) { fontSize = 18, fontStyle = FontStyle.Bold });
                var lang = CurrentLanguage(tcg);
                var owned = CountOwnedForTcg(tcg.Id, lang);
                GUILayout.Label($"{tcg.Sets.Count} collections • langue {lang} • {owned} cartes possédées");
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("Voir les boosters", GUILayout.Width(160)))
                {
                    _selectedTcg = tcg.Id;
                    _view = "store";
                    _scroll = Vector2.zero;
                }
                if (GUILayout.Button("Voir la collection", GUILayout.Width(160)))
                {
                    _selectedTcg = tcg.Id;
                    _view = "collection";
                    _scroll = Vector2.zero;
                }
                GUILayout.EndHorizontal();
                GUILayout.EndVertical();
            }

            GUILayout.Space(10);
            GUILayout.Label("F8 ouvre/ferme toujours MultiTCG, même sans Phone Overhaul.", _mutedStyle);
        }

        private void DrawStore()
        {
            GUILayout.Label("Boutique MultiTCG", _titleStyle);
            DrawTcgSelector();
            var tcg = GetSelectedTcg();
            if (tcg == null) return;
            var lang = CurrentLanguage(tcg);
            GUILayout.Label($"Langue active : {lang}", _mutedStyle);

            foreach (var set in tcg.Sets)
            {
                if (!set.SupportsLanguage(lang)) continue;
                var boosters = _player.GetBoosters(set.Id, lang);
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.BeginVertical(GUILayout.ExpandWidth(true));
                GUILayout.Label(set.Name, new GUIStyle(GUI.skin.label) { fontSize = 17, fontStyle = FontStyle.Bold });
                GUILayout.Label($"{set.Cards.Count} cartes • Booster {set.BoosterPrice:0.##}$ • Possédés : {boosters}");
                GUILayout.EndVertical();
                if (GUILayout.Button("Ouvrir", GUILayout.Width(100), GUILayout.Height(34)))
                {
                    _selectedSet = set.Id;
                    _view = "set";
                    _scroll = Vector2.zero;
                }
                GUILayout.EndHorizontal();
            }
        }

        private void DrawSet()
        {
            var tcg = GetSelectedTcg();
            var set = _catalog.FindSet(_selectedSet);
            if (tcg == null || set == null)
            {
                _view = "store";
                return;
            }

            var lang = CurrentLanguage(tcg);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("← Retour", GUILayout.Width(100))) _view = "store";
            GUILayout.Label(set.Name, _titleStyle);
            GUILayout.EndHorizontal();
            GUILayout.Label($"{tcg.Name} • {lang} • {set.Cards.Count} cartes");
            GUILayout.Space(8);

            var boosters = _player.GetBoosters(set.Id, lang);
            GUILayout.Label($"Boosters en stock : {boosters}", new GUIStyle(GUI.skin.label) { fontSize = 17, fontStyle = FontStyle.Bold });
            GUILayout.BeginHorizontal();
            if (GUILayout.Button($"Acheter un booster — {set.BoosterPrice:0.##}$", GUILayout.Width(250), GUILayout.Height(36)))
                BuyBooster(tcg, set, lang);
            GUI.enabled = boosters > 0;
            if (GUILayout.Button("Ouvrir un booster", GUILayout.Width(200), GUILayout.Height(36)))
                OpenBooster(tcg, set, lang);
            GUI.enabled = true;
            GUILayout.EndHorizontal();

            if (!string.IsNullOrEmpty(_lastPack))
            {
                GUILayout.Space(10);
                GUILayout.Label("Dernier booster", new GUIStyle(GUI.skin.label) { fontSize = 16, fontStyle = FontStyle.Bold });
                GUILayout.TextArea(_lastPack, GUILayout.MinHeight(120));
            }

            GUILayout.Space(10);
            var uniqueOwned = set.Cards.Count(c => _player.GetCardCount(set.Id, lang, c.Id) > 0);
            GUILayout.Label($"Progression : {uniqueOwned} / {set.Cards.Count} cartes différentes");
        }

        private void DrawCollection()
        {
            GUILayout.Label("Collections", _titleStyle);
            DrawTcgSelector();
            var tcg = GetSelectedTcg();
            if (tcg == null) return;
            var lang = CurrentLanguage(tcg);
            GUILayout.Label($"Collection {tcg.Name} — {lang}", _mutedStyle);

            foreach (var set in tcg.Sets)
            {
                if (!set.SupportsLanguage(lang)) continue;
                var uniqueOwned = set.Cards.Count(c => _player.GetCardCount(set.Id, lang, c.Id) > 0);
                var totalCopies = set.Cards.Sum(c => _player.GetCardCount(set.Id, lang, c.Id));
                GUILayout.BeginVertical(GUI.skin.box);
                GUILayout.Label($"{set.Name}   {uniqueOwned}/{set.Cards.Count}", new GUIStyle(GUI.skin.label) { fontSize = 16, fontStyle = FontStyle.Bold });
                GUILayout.Label($"{totalCopies} cartes au total");
                foreach (var card in set.Cards)
                {
                    var count = _player.GetCardCount(set.Id, lang, card.Id);
                    if (count > 0)
                        GUILayout.Label($"✓ #{card.Number:000} {card.Name} [{card.Rarity}] ×{count}");
                }
                GUILayout.EndVertical();
            }
        }

        private void DrawLanguages()
        {
            GUILayout.Label("Langues des cartes", _titleStyle);
            GUILayout.Label("Chaque langue est une collection séparée : une carte FR et la même carte EN peuvent donc être collectionnées indépendamment.", _mutedStyle);
            GUILayout.Space(8);
            foreach (var tcg in _catalog.Tcgs)
            {
                GUILayout.BeginHorizontal(GUI.skin.box);
                GUILayout.Label(tcg.Name, GUILayout.Width(220));
                GUILayout.Label(CurrentLanguage(tcg), GUILayout.Width(80));
                foreach (var lang in tcg.Languages)
                {
                    GUI.enabled = !string.Equals(CurrentLanguage(tcg), lang, StringComparison.OrdinalIgnoreCase);
                    if (GUILayout.Button(lang, GUILayout.Width(60)))
                    {
                        _languageByTcg[tcg.Id] = lang;
                        _status = $"{tcg.Name} : langue active {lang}.";
                        Save();
                    }
                }
                GUI.enabled = true;
                GUILayout.EndHorizontal();
            }
        }

        private void DrawTcgSelector()
        {
            GUILayout.BeginHorizontal();
            foreach (var tcg in _catalog.Tcgs)
            {
                GUI.enabled = !string.Equals(_selectedTcg, tcg.Id, StringComparison.OrdinalIgnoreCase);
                if (GUILayout.Button(tcg.Name, GUILayout.Height(30)))
                {
                    _selectedTcg = tcg.Id;
                    _selectedSet = null;
                    _scroll = Vector2.zero;
                }
            }
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.Space(8);
        }

        private TcgDefinition GetSelectedTcg()
        {
            if (string.IsNullOrEmpty(_selectedTcg) && _catalog.Tcgs.Count > 0)
                _selectedTcg = _catalog.Tcgs[0].Id;
            return _catalog.Tcgs.FirstOrDefault(t => string.Equals(t.Id, _selectedTcg, StringComparison.OrdinalIgnoreCase));
        }

        private string CurrentLanguage(TcgDefinition tcg)
        {
            if (tcg == null || tcg.Languages.Count == 0) return "FR";
            if (_languageByTcg.TryGetValue(tcg.Id, out var lang) && tcg.Languages.Contains(lang)) return lang;
            var preferred = tcg.Languages.Contains("FR") ? "FR" : tcg.Languages[0];
            _languageByTcg[tcg.Id] = preferred;
            return preferred;
        }

        private int CountOwnedForTcg(string tcgId, string lang)
        {
            var tcg = _catalog.Tcgs.FirstOrDefault(t => t.Id == tcgId);
            if (tcg == null) return 0;
            return tcg.Sets.Sum(s => s.Cards.Sum(c => _player.GetCardCount(s.Id, lang, c.Id)));
        }

        private void BuyBooster(TcgDefinition tcg, SetDefinition set, string lang)
        {
            var spend = GameEconomy.TrySpend(set.BoosterPrice, out var reason);
            if (!spend)
            {
                _status = reason;
                PhoneBridge.Notify(PhoneAppId, reason);
                return;
            }

            _player.AddBooster(set.Id, lang, 1);
            Save();
            _status = $"Booster {set.Name} ({lang}) acheté.";
        }

        private void OpenBooster(TcgDefinition tcg, SetDefinition set, string lang)
        {
            if (_player.GetBoosters(set.Id, lang) <= 0)
            {
                _status = "Aucun booster à ouvrir.";
                return;
            }

            _player.AddBooster(set.Id, lang, -1);
            var pulls = new List<CardDefinition>();
            for (var i = 0; i < 7; i++)
            {
                var card = set.RollCard();
                if (card == null) continue;
                pulls.Add(card);
                _player.AddCard(set.Id, lang, card.Id, 1);
            }
            Save();
            _lastPack = string.Join("\n", pulls.Select(c => $"#{c.Number:000}  {c.Name}  — {c.Rarity}"));
            _status = $"Booster {set.Name} ouvert : {pulls.Count} cartes ajoutées à la collection {lang}.";
        }

        private void ToggleVisible()
        {
            _visible = !_visible;
            if (_visible)
            {
                _view = "home";
                _scroll = Vector2.zero;
                PhoneBridge.ClearBadge(PhoneAppId);
            }
        }

        private void OpenFromPhone()
        {
            _visible = true;
            _view = "home";
            _scroll = Vector2.zero;
            PhoneBridge.ClearBadge(PhoneAppId);
        }

        private bool TryRegisterPhoneApp()
        {
            if (_phoneRegistered) return true;
            try
            {
                if (!PhoneBridge.TryRegister(PhoneAppId, "MultiTCG", "MultiTCG", OpenFromPhone))
                    return false;
                _phoneRegistered = true;
                _status = "Application MultiTCG enregistrée sur Phone Overhaul.";
                Logger.LogInfo("Phone Overhaul detected; MultiTCG app registered.");
                return true;
            }
            catch (Exception ex)
            {
                Logger.LogDebug("Phone app registration retry: " + ex.Message);
                return false;
            }
        }

        private void LoadCatalogs()
        {
            _catalog.Clear();
            try
            {
                foreach (var file in Directory.GetFiles(DataRoot, "*.mtcg", SearchOption.AllDirectories))
                    CatalogParser.Load(file, _catalog, Logger);
            }
            catch (Exception ex)
            {
                Logger.LogError("Could not load MultiTCG catalogs: " + ex);
            }
            _catalog.FinalizeCatalog();
            Logger.LogInfo($"Loaded {_catalog.Tcgs.Count} TCG(s), {_catalog.Tcgs.Sum(t => t.Sets.Count)} set(s)." );
        }

        private void LoadSave()
        {
            try
            {
                if (!File.Exists(SavePath)) return;
                foreach (var raw in File.ReadAllLines(SavePath))
                {
                    var line = raw.Trim();
                    if (line.Length == 0 || line.StartsWith("#")) continue;
                    var p = line.Split('|');
                    if (p.Length >= 3 && p[0] == "LANG") _languageByTcg[p[1]] = p[2];
                    else if (p.Length >= 4 && p[0] == "BOOSTER" && int.TryParse(p[3], out var b)) _player.SetBooster(p[1], p[2], b);
                    else if (p.Length >= 5 && p[0] == "CARD" && int.TryParse(p[4], out var c)) _player.SetCard(p[1], p[2], p[3], c);
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Could not load MultiTCG save: " + ex);
            }
        }

        private void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SavePath));
                var lines = new List<string> { "# MultiTCG save v2" };
                lines.AddRange(_languageByTcg.Select(kv => $"LANG|{kv.Key}|{kv.Value}"));
                lines.AddRange(_player.ExportLines());
                File.WriteAllLines(SavePath, lines.ToArray());
            }
            catch (Exception ex)
            {
                Logger.LogError("Could not save MultiTCG data: " + ex);
            }
        }
    }

    internal static class PhoneBridge
    {
        private static object _registry;

        internal static bool TryRegister(string appId, string displayName, string icon, Action onClick)
        {
            if (!TryGetRegistry(out var registry)) return false;
            var appSpecType = FindType("AppSpec");
            if (appSpecType == null) return false;
            var spec = Activator.CreateInstance(appSpecType);
            SetMember(spec, "AppId", appId);
            SetMember(spec, "DisplayName", displayName);
            SetMember(spec, "Icon", icon);
            SetMember(spec, "InnerBackground", null);
            SetMember(spec, "OuterBackground", null);
            SetMember(spec, "OnClick", onClick);
            var register = registry.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)
                .FirstOrDefault(m => m.Name == "Register" && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType.IsAssignableFrom(appSpecType));
            if (register == null) return false;
            register.Invoke(registry, new[] { spec });
            _registry = registry;
            return true;
        }

        internal static void Notify(string appId, string message)
        {
            try
            {
                if (!TryGetRegistry(out var registry)) return;
                var m = registry.GetType().GetMethods().FirstOrDefault(x => x.Name == "ShowNotification" && x.GetParameters().Length == 2);
                m?.Invoke(registry, new object[] { appId, message });
            }
            catch { }
        }

        internal static void ClearBadge(string appId)
        {
            try
            {
                if (!TryGetRegistry(out var registry)) return;
                var m = registry.GetType().GetMethods().FirstOrDefault(x => x.Name == "SetBadgeCount" && x.GetParameters().Length == 2);
                m?.Invoke(registry, new object[] { appId, 0 });
            }
            catch { }
        }

        private static bool TryGetRegistry(out object registry)
        {
            if (_registry != null)
            {
                registry = _registry;
                return true;
            }
            var api = FindType("PhoneOverhaulAPI");
            if (api == null)
            {
                registry = null;
                return false;
            }
            var prop = api.GetProperty("Registry", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            var field = api.GetField("Registry", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            registry = prop != null ? prop.GetValue(null, null) : field?.GetValue(null);
            if (registry != null) _registry = registry;
            return registry != null;
        }

        private static Type FindType(string simpleName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                try
                {
                    var direct = asm.GetType(simpleName, false);
                    if (direct != null) return direct;
                    foreach (var type in asm.GetTypes())
                        if (type.Name == simpleName) return type;
                }
                catch (ReflectionTypeLoadException ex)
                {
                    foreach (var type in ex.Types)
                        if (type != null && type.Name == simpleName) return type;
                }
                catch { }
            }
            return null;
        }

        private static void SetMember(object target, string name, object value)
        {
            var type = target.GetType();
            var prop = type.GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            if (prop != null && prop.CanWrite)
            {
                prop.SetValue(target, value, null);
                return;
            }
            var field = type.GetField(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
            field?.SetValue(target, value);
        }
    }

    internal static class GameEconomy
    {
        internal static bool TrySpend(float amount, out string reason)
        {
            if (amount <= 0f)
            {
                reason = "Achat validé.";
                return true;
            }

            if (TryReadMoney(out var current) && current + 0.001f < amount)
            {
                reason = $"Pas assez d'argent ({current:0.##}$ disponibles).";
                return false;
            }

            try
            {
                var eventType = FindType("CEventPlayer_ReduceCoin");
                var managerType = FindType("CEventManager");
                if (eventType == null || managerType == null)
                {
                    reason = "Impossible de trouver le système d'argent du jeu. Achat annulé.";
                    return false;
                }

                object evt = null;
                var intAmount = Mathf.CeilToInt(amount);
                var candidates = new object[][]
                {
                    new object[] { intAmount, true }, new object[] { amount, true },
                    new object[] { intAmount }, new object[] { amount }
                };
                foreach (var args in candidates)
                {
                    try { evt = Activator.CreateInstance(eventType, args); if (evt != null) break; }
                    catch { }
                }
                if (evt == null)
                {
                    reason = "Transaction MultiTCG annulée : événement monétaire incompatible.";
                    return false;
                }

                var queue = managerType.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
                    .FirstOrDefault(m => m.Name == "QueueEvent" && m.GetParameters().Length == 1 && m.GetParameters()[0].ParameterType.IsAssignableFrom(eventType));
                if (queue == null)
                {
                    reason = "Transaction MultiTCG annulée : QueueEvent introuvable.";
                    return false;
                }
                queue.Invoke(null, new[] { evt });
                reason = $"{amount:0.##}$ débités.";
                return true;
            }
            catch (Exception ex)
            {
                MultiTcgCorePlugin.Log?.LogError("MultiTCG purchase failed: " + ex);
                reason = "Transaction MultiTCG annulée : erreur du jeu.";
                return false;
            }
        }

        private static bool TryReadMoney(out float value)
        {
            value = 0f;
            var type = FindType("CPlayerData");
            if (type == null) return false;
            var flags = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            foreach (var name in new[] { "GetCoin", "GetMoney", "GetCash", "GetCoinAmount", "GetCurrentCoin" })
            {
                try
                {
                    var m = type.GetMethod(name, flags, null, Type.EmptyTypes, null);
                    if (m != null && TryNumber(m.Invoke(null, null), out value)) return true;
                }
                catch { }
            }
            foreach (var member in type.GetMembers(flags))
            {
                if (member.Name.IndexOf("coin", StringComparison.OrdinalIgnoreCase) < 0 && member.Name.IndexOf("money", StringComparison.OrdinalIgnoreCase) < 0) continue;
                try
                {
                    object raw = null;
                    if (member is FieldInfo f) raw = f.GetValue(null);
                    else if (member is PropertyInfo p && p.GetIndexParameters().Length == 0) raw = p.GetValue(null, null);
                    if (TryNumber(raw, out value)) return true;
                }
                catch { }
            }
            return false;
        }

        private static bool TryNumber(object raw, out float value)
        {
            value = 0f;
            if (raw == null) return false;
            try { value = Convert.ToSingle(raw, CultureInfo.InvariantCulture); return true; }
            catch { return false; }
        }

        private static Type FindType(string simpleName)
        {
            foreach (var asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                try
                {
                    var t = asm.GetTypes().FirstOrDefault(x => x.Name == simpleName);
                    if (t != null) return t;
                }
                catch { }
            }
            return null;
        }
    }

    internal sealed class Catalog
    {
        internal readonly List<TcgDefinition> Tcgs = new List<TcgDefinition>();
        internal void Clear() => Tcgs.Clear();
        internal TcgDefinition FindTcg(string id) => Tcgs.FirstOrDefault(t => string.Equals(t.Id, id, StringComparison.OrdinalIgnoreCase));
        internal SetDefinition FindSet(string id) => Tcgs.SelectMany(t => t.Sets).FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
        internal void FinalizeCatalog()
        {
            foreach (var tcg in Tcgs)
            {
                tcg.Sets.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
                foreach (var set in tcg.Sets) set.Cards.Sort((a, b) => a.Number.CompareTo(b.Number));
            }
        }
    }

    internal sealed class TcgDefinition
    {
        internal string Id;
        internal string Name;
        internal readonly List<string> Languages = new List<string>();
        internal readonly List<SetDefinition> Sets = new List<SetDefinition>();
    }

    internal sealed class SetDefinition
    {
        internal string Id;
        internal string TcgId;
        internal string Name;
        internal float BoosterPrice;
        internal readonly List<string> Languages = new List<string>();
        internal readonly List<CardDefinition> Cards = new List<CardDefinition>();
        internal bool SupportsLanguage(string lang) => Languages.Count == 0 || Languages.Contains(lang);
        internal CardDefinition RollCard()
        {
            if (Cards.Count == 0) return null;
            var roll = UnityEngine.Random.value * 100f;
            var rarity = roll < 5f ? "Epic" : roll < 25f ? "Rare" : "Common";
            var pool = Cards.Where(c => string.Equals(c.Rarity, rarity, StringComparison.OrdinalIgnoreCase)).ToList();
            if (pool.Count == 0) pool = Cards;
            return pool[UnityEngine.Random.Range(0, pool.Count)];
        }
    }

    internal sealed class CardDefinition
    {
        internal string Id;
        internal int Number;
        internal string Name;
        internal string Rarity;
    }

    internal static class CatalogParser
    {
        internal static void Load(string path, Catalog catalog, ManualLogSource log)
        {
            var setLookup = new Dictionary<string, SetDefinition>(StringComparer.OrdinalIgnoreCase);
            foreach (var t in catalog.Tcgs)
                foreach (var s in t.Sets) setLookup[s.Id] = s;

            var lineNo = 0;
            foreach (var raw in File.ReadAllLines(path))
            {
                lineNo++;
                var line = raw.Trim();
                if (line.Length == 0 || line.StartsWith("#")) continue;
                var p = line.Split('|');
                try
                {
                    if (p[0] == "TCG" && p.Length >= 4)
                    {
                        var tcg = catalog.FindTcg(p[1]);
                        if (tcg == null)
                        {
                            tcg = new TcgDefinition { Id = p[1], Name = p[2] };
                            catalog.Tcgs.Add(tcg);
                        }
                        foreach (var lang in p[3].Split(',')) if (!tcg.Languages.Contains(lang.Trim())) tcg.Languages.Add(lang.Trim());
                    }
                    else if (p[0] == "SET" && p.Length >= 6)
                    {
                        var tcg = catalog.FindTcg(p[1]);
                        if (tcg == null) throw new InvalidDataException("Unknown TCG " + p[1]);
                        if (!float.TryParse(p[4], NumberStyles.Float, CultureInfo.InvariantCulture, out var price)) price = 4f;
                        var set = new SetDefinition { TcgId = tcg.Id, Id = p[2], Name = p[3], BoosterPrice = price };
                        foreach (var lang in p[5].Split(',')) set.Languages.Add(lang.Trim());
                        tcg.Sets.Add(set);
                        setLookup[set.Id] = set;
                    }
                    else if (p[0] == "CARD" && p.Length >= 6)
                    {
                        if (!setLookup.TryGetValue(p[1], out var set)) throw new InvalidDataException("Unknown SET " + p[1]);
                        if (!int.TryParse(p[3], out var num)) num = set.Cards.Count + 1;
                        set.Cards.Add(new CardDefinition { Id = p[2], Number = num, Name = p[4], Rarity = p[5] });
                    }
                }
                catch (Exception ex)
                {
                    log.LogWarning($"Catalog {Path.GetFileName(path)} line {lineNo} ignored: {ex.Message}");
                }
            }
        }
    }

    internal sealed class PlayerCollection
    {
        private readonly Dictionary<string, int> _boosters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _cards = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private static string BKey(string setId, string lang) => setId + "@" + lang;
        private static string CKey(string setId, string lang, string cardId) => setId + "@" + lang + "@" + cardId;
        internal int GetBoosters(string setId, string lang) => _boosters.TryGetValue(BKey(setId, lang), out var n) ? n : 0;
        internal void AddBooster(string setId, string lang, int delta) => SetBooster(setId, lang, GetBoosters(setId, lang) + delta);
        internal void SetBooster(string setId, string lang, int value) => _boosters[BKey(setId, lang)] = Math.Max(0, value);
        internal int GetCardCount(string setId, string lang, string cardId) => _cards.TryGetValue(CKey(setId, lang, cardId), out var n) ? n : 0;
        internal void AddCard(string setId, string lang, string cardId, int delta) => SetCard(setId, lang, cardId, GetCardCount(setId, lang, cardId) + delta);
        internal void SetCard(string setId, string lang, string cardId, int value) => _cards[CKey(setId, lang, cardId)] = Math.Max(0, value);
        internal IEnumerable<string> ExportLines()
        {
            foreach (var kv in _boosters.Where(k => k.Value > 0))
            {
                var p = kv.Key.Split('@');
                if (p.Length == 2) yield return $"BOOSTER|{p[0]}|{p[1]}|{kv.Value}";
            }
            foreach (var kv in _cards.Where(k => k.Value > 0))
            {
                var p = kv.Key.Split('@');
                if (p.Length == 3) yield return $"CARD|{p[0]}|{p[1]}|{p[2]}|{kv.Value}";
            }
        }
    }
}
