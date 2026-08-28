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
using UnityEngine.UI;

namespace VOX.MultiTCG
{
    [BepInPlugin(PluginGuid, PluginName, PluginVersion)]
    public sealed class MultiTcgPhoneNativePlugin : BaseUnityPlugin
    {
        public const string PluginGuid = "fr.vox.multitcg.core";
        public const string PluginName = "MultiTCG";
        public const string PluginVersion = "0.3.0";
        private const string PhoneAppId = "MultiTCG";

        internal static ManualLogSource Log;
        internal static MultiTcgPhoneNativePlugin Instance;

        private readonly Catalog _catalog = new Catalog();
        private readonly PlayerState _player = new PlayerState();
        private readonly Dictionary<string, string> _languages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private NativePhoneUi _ui;
        private bool _phoneRegistered;

        private string Root => Path.Combine(Paths.PluginPath, "MultiTCG");
        private string DataRoot => Path.Combine(Root, "Data");
        private string SavePath => Path.Combine(Application.persistentDataPath, "MultiTCG", "save_v3.txt");

        private void Awake()
        {
            Instance = this;
            Log = Logger;
            Directory.CreateDirectory(DataRoot);
            LoadCatalog();
            LoadSave();
            Logger.LogInfo("MultiTCG v0.3.0 loaded. Phone-native UI only; vanilla/Tetramon cards are untouched.");
        }

        private IEnumerator Start()
        {
            for (int frame = 0; frame < 1200 && !_phoneRegistered; frame++)
            {
                if (PhoneBridge.TryRegister(PhoneAppId, "MultiTCG", "MultiTCG", OpenFromPhone))
                {
                    _phoneRegistered = true;
                    Logger.LogInfo("Phone Overhaul API detected; MultiTCG registered as a native phone app.");
                    yield break;
                }
                yield return null;
            }
            Logger.LogError("Phone Overhaul API was not detected. MultiTCG v0.3 intentionally has no desktop/F8 fallback.");
        }

        private void OpenFromPhone()
        {
            try
            {
                PhoneBridge.ClearBadge(PhoneAppId);
                if (_ui == null) _ui = new NativePhoneUi(this);
                if (!_ui.Open())
                {
                    Logger.LogError("MultiTCG app icon was clicked, but no suitable Phone Overhaul screen container could be found.");
                    PhoneBridge.Notify(PhoneAppId, "MultiTCG n'a pas trouvé l'écran du téléphone. Vérifie LogOutput.log.");
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Opening native MultiTCG phone UI failed: " + ex);
                PhoneBridge.Notify(PhoneAppId, "Erreur lors de l'ouverture de MultiTCG.");
            }
        }

        internal IReadOnlyList<TcgDef> Tcgs => _catalog.Tcgs;

        internal string LanguageFor(TcgDef tcg)
        {
            if (tcg == null) return "FR";
            if (_languages.TryGetValue(tcg.Id, out var lang) && tcg.Languages.Contains(lang)) return lang;
            var chosen = tcg.Languages.Contains("FR") ? "FR" : (tcg.Languages.Count > 0 ? tcg.Languages[0] : "FR");
            _languages[tcg.Id] = chosen;
            return chosen;
        }

        internal void SetLanguage(TcgDef tcg, string lang)
        {
            if (tcg == null || !tcg.Languages.Contains(lang)) return;
            _languages[tcg.Id] = lang;
            Save();
        }

        internal int OwnedUnique(SetDef set, string lang) => set.Cards.Count(c => _player.CardCount(set.Id, lang, c.Id) > 0);
        internal int OwnedTotal(SetDef set, string lang) => set.Cards.Sum(c => _player.CardCount(set.Id, lang, c.Id));
        internal int BoosterCount(SetDef set, string lang) => _player.BoosterCount(set.Id, lang);

        internal bool BuyBooster(SetDef set, string lang, out string message)
        {
            if (!GameEconomy.TrySpend(set.Price, out message)) return false;
            _player.AddBooster(set.Id, lang, 1);
            Save();
            message = "Booster " + set.Name + " acheté.";
            return true;
        }

        internal List<CardDef> OpenBooster(SetDef set, string lang, out string message)
        {
            var pulls = new List<CardDef>();
            if (_player.BoosterCount(set.Id, lang) <= 0)
            {
                message = "Aucun booster à ouvrir.";
                return pulls;
            }

            _player.AddBooster(set.Id, lang, -1);
            for (int i = 0; i < 7; i++)
            {
                var card = set.Roll();
                if (card == null) continue;
                pulls.Add(card);
                _player.AddCard(set.Id, lang, card.Id, 1);
            }
            Save();
            message = "Booster ouvert : " + pulls.Count + " cartes ajoutées.";
            return pulls;
        }

        private void LoadCatalog()
        {
            _catalog.Tcgs.Clear();
            try
            {
                foreach (var file in Directory.GetFiles(DataRoot, "*.mtcg", SearchOption.AllDirectories))
                    CatalogParser.Load(file, _catalog, Logger);
            }
            catch (Exception ex) { Logger.LogError("Catalog load failed: " + ex); }
            _catalog.FinalizeData();
            Logger.LogInfo("MultiTCG catalog: " + _catalog.Tcgs.Count + " TCG(s), " + _catalog.Tcgs.Sum(t => t.Sets.Count) + " set(s).");
        }

        private void LoadSave()
        {
            try
            {
                if (!File.Exists(SavePath)) return;
                foreach (var raw in File.ReadAllLines(SavePath))
                {
                    var p = raw.Split('|');
                    if (p.Length >= 3 && p[0] == "LANG") _languages[p[1]] = p[2];
                    else if (p.Length >= 4 && p[0] == "BOOSTER" && int.TryParse(p[3], out var b)) _player.SetBooster(p[1], p[2], b);
                    else if (p.Length >= 5 && p[0] == "CARD" && int.TryParse(p[4], out var c)) _player.SetCard(p[1], p[2], p[3], c);
                }
            }
            catch (Exception ex) { Logger.LogError("Save load failed: " + ex); }
        }

        private void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SavePath));
                var lines = new List<string> { "# MultiTCG save v3" };
                lines.AddRange(_languages.Select(kv => "LANG|" + kv.Key + "|" + kv.Value));
                lines.AddRange(_player.Export());
                File.WriteAllLines(SavePath, lines.ToArray());
            }
            catch (Exception ex) { Logger.LogError("Save failed: " + ex); }
        }
    }

    internal sealed class NativePhoneUi
    {
        private readonly MultiTcgPhoneNativePlugin _plugin;
        private GameObject _root;
        private RectTransform _host;
        private RectTransform _body;
        private Text _status;
        private Font _font;
        private string _view = "home";
        private string _selectedTcg;
        private string _lastPull = string.Empty;

        private readonly Color _bg = new Color32(18, 20, 26, 255);
        private readonly Color _surface = new Color32(31, 35, 44, 255);
        private readonly Color _surface2 = new Color32(42, 47, 58, 255);
        private readonly Color _accent = new Color32(109, 91, 255, 255);
        private readonly Color _text = new Color32(244, 245, 248, 255);
        private readonly Color _muted = new Color32(172, 178, 190, 255);
        private readonly Color _good = new Color32(86, 205, 137, 255);

        internal NativePhoneUi(MultiTcgPhoneNativePlugin plugin) { _plugin = plugin; }

        internal bool Open()
        {
            _host = FindHost();
            if (_host == null) return false;

            if (_root == null || !_root)
                BuildShell();
            else if (_root.transform.parent != _host)
                _root.transform.SetParent(_host, false);

            _root.SetActive(true);
            _root.transform.SetAsLastSibling();
            _view = "home";
            Render();
            return true;
        }

        private RectTransform FindHost()
        {
            try
            {
                RectTransform icon = null;
                var texts = Resources.FindObjectsOfTypeAll<Text>();
                foreach (var t in texts)
                {
                    if (t == null || !t.gameObject.scene.IsValid()) continue;
                    if (!string.Equals((t.text ?? string.Empty).Trim(), "MultiTCG", StringComparison.OrdinalIgnoreCase)) continue;
                    icon = t.rectTransform;
                    break;
                }

                if (icon == null)
                {
                    foreach (var r in Resources.FindObjectsOfTypeAll<RectTransform>())
                    {
                        if (r == null || !r.gameObject.scene.IsValid()) continue;
                        if (r.name.IndexOf("MultiTCG", StringComparison.OrdinalIgnoreCase) >= 0) { icon = r; break; }
                    }
                }

                if (icon != null)
                {
                    Transform p = icon;
                    RectTransform lastUseful = null;
                    while (p != null)
                    {
                        var rt = p as RectTransform;
                        if (rt != null && rt.rect.width > 220f && rt.rect.height > 280f) lastUseful = rt;
                        var grid = p.GetComponent<GridLayoutGroup>();
                        if (grid != null)
                        {
                            var parent = p.parent as RectTransform;
                            if (parent != null)
                            {
                                MultiTcgPhoneNativePlugin.Log.LogInfo("Phone host resolved from MultiTCG app grid: " + Hierarchy(parent));
                                return parent;
                            }
                        }
                        if (p.GetComponent<Canvas>() != null && lastUseful != null) break;
                        p = p.parent;
                    }
                    if (lastUseful != null)
                    {
                        MultiTcgPhoneNativePlugin.Log.LogInfo("Phone host resolved from MultiTCG icon ancestry: " + Hierarchy(lastUseful));
                        return lastUseful;
                    }
                }

                RectTransform best = null;
                float bestScore = float.MinValue;
                foreach (var rt in Resources.FindObjectsOfTypeAll<RectTransform>())
                {
                    if (rt == null || !rt.gameObject.scene.IsValid() || !rt.gameObject.activeInHierarchy) continue;
                    var path = Hierarchy(rt);
                    if (path.IndexOf("phone", StringComparison.OrdinalIgnoreCase) < 0) continue;
                    var w = Mathf.Abs(rt.rect.width); var h = Mathf.Abs(rt.rect.height);
                    if (w < 220f || h < 280f) continue;
                    float portrait = h >= w ? 80f : 0f;
                    float size = Mathf.Min(w, 900f) + Mathf.Min(h, 1200f);
                    float name = rt.name.IndexOf("screen", StringComparison.OrdinalIgnoreCase) >= 0 ? 200f : 0f;
                    float score = portrait + size + name;
                    if (score > bestScore) { bestScore = score; best = rt; }
                }
                if (best != null) MultiTcgPhoneNativePlugin.Log.LogInfo("Phone host resolved by fallback scan: " + Hierarchy(best));
                return best;
            }
            catch (Exception ex)
            {
                MultiTcgPhoneNativePlugin.Log.LogError("Phone host discovery failed: " + ex);
                return null;
            }
        }

        private static string Hierarchy(Transform t)
        {
            var parts = new List<string>();
            for (var p = t; p != null && parts.Count < 10; p = p.parent) parts.Add(p.name);
            parts.Reverse();
            return string.Join("/", parts.ToArray());
        }

        private void BuildShell()
        {
            _font = FindFont();
            _root = CreateRect("MultiTCG_NativePhoneApp", _host, _bg);
            var rr = _root.GetComponent<RectTransform>();
            Stretch(rr, 0f, 0f, 0f, 0f);
            var ignore = _root.AddComponent<LayoutElement>();
            ignore.ignoreLayout = true;

            var header = CreateRect("Header", rr, _surface);
            Stretch(header.GetComponent<RectTransform>(), 0f, 0f, 0.88f, 1f);
            var back = CreateButton(header.transform, "‹", () => Close(), _surface2, 34);
            SetRect(back.GetComponent<RectTransform>(), 0.02f, 0.12f, 0.15f, 0.88f);
            var title = CreateText(header.transform, "MultiTCG", 28, TextAnchor.MiddleLeft, _text, FontStyle.Bold);
            SetRect(title.rectTransform, 0.18f, 0.10f, 0.98f, 0.90f);

            var bodyGo = CreateRect("Body", rr, _bg);
            _body = bodyGo.GetComponent<RectTransform>();
            Stretch(_body, 0f, 0f, 0.13f, 0.88f);

            var nav = CreateRect("BottomNav", rr, _surface);
            SetRect(nav.GetComponent<RectTransform>(), 0f, 0f, 1f, 0.13f);
            AddBottomButton(nav.transform, "Boutique", () => { _view = "store"; Render(); }, 0f, 0.333f);
            AddBottomButton(nav.transform, "Collection", () => { _view = "collection"; Render(); }, 0.333f, 0.666f);
            AddBottomButton(nav.transform, "Langues", () => { _view = "languages"; Render(); }, 0.666f, 1f);

            var statusBar = CreateRect("Status", rr, new Color32(22, 25, 32, 255));
            SetRect(statusBar.GetComponent<RectTransform>(), 0f, 0.88f, 1f, 0.94f);
            _status = CreateText(statusBar.transform, "Prêt", 14, TextAnchor.MiddleCenter, _muted, FontStyle.Normal);
            Stretch(_status.rectTransform, 0.02f, 0f, 0.98f, 1f);
        }

        private void AddBottomButton(Transform parent, string label, Action action, float min, float max)
        {
            var b = CreateButton(parent, label, action, _surface, 16);
            SetRect(b.GetComponent<RectTransform>(), min, 0f, max, 1f);
        }

        private void Close()
        {
            if (_root != null) _root.SetActive(false);
        }

        private void Render()
        {
            if (_body == null) return;
            ClearChildren(_body);
            if (_status != null) _status.text = "MultiTCG · contenu ajouté sans remplacer Tetramon";
            if (_plugin.Tcgs.Count == 0) { RenderEmpty(); return; }
            if (_view == "store") RenderStore();
            else if (_view == "collection") RenderCollection();
            else if (_view == "languages") RenderLanguages();
            else RenderHome();
        }

        private RectTransform MakeScroll()
        {
            var scrollGo = CreateRect("Scroll", _body, _bg);
            Stretch(scrollGo.GetComponent<RectTransform>(), 0f, 0f, 1f, 1f);
            var viewport = CreateRect("Viewport", scrollGo.transform, new Color(0,0,0,0));
            Stretch(viewport.GetComponent<RectTransform>(), 0.025f, 0.02f, 0.975f, 0.98f);
            viewport.AddComponent<RectMask2D>();
            var content = new GameObject("Content", typeof(RectTransform), typeof(VerticalLayoutGroup), typeof(ContentSizeFitter));
            content.transform.SetParent(viewport.transform, false);
            var cr = content.GetComponent<RectTransform>();
            cr.anchorMin = new Vector2(0f, 1f); cr.anchorMax = new Vector2(1f, 1f); cr.pivot = new Vector2(0.5f, 1f); cr.anchoredPosition = Vector2.zero; cr.sizeDelta = Vector2.zero;
            var layout = content.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 10f; layout.padding = new RectOffset(8, 8, 8, 8); layout.childControlHeight = true; layout.childControlWidth = true; layout.childForceExpandHeight = false; layout.childForceExpandWidth = true;
            content.GetComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            var scroll = scrollGo.AddComponent<ScrollRect>();
            scroll.viewport = viewport.GetComponent<RectTransform>(); scroll.content = cr; scroll.horizontal = false; scroll.vertical = true; scroll.movementType = ScrollRect.MovementType.Clamped; scroll.scrollSensitivity = 28f;
            return cr;
        }

        private void RenderHome()
        {
            var c = MakeScroll();
            AddSectionTitle(c, "Ta boutique de cartes");
            AddParagraph(c, "Choisis un TCG. Chaque licence, extension et langue reste séparée des cartes du jeu de base.");
            foreach (var tcg in _plugin.Tcgs)
            {
                var local = tcg;
                var card = CreateCard(c, 105f);
                AddText(card.transform, tcg.Name, 22, TextAnchor.MiddleLeft, _text, FontStyle.Bold, 0.04f, 0.38f, 0.70f, 0.92f);
                var lang = _plugin.LanguageFor(tcg);
                AddText(card.transform, tcg.Sets.Count + " collections · " + lang, 14, TextAnchor.MiddleLeft, _muted, FontStyle.Normal, 0.04f, 0.08f, 0.70f, 0.42f);
                var b = CreateButton(card.transform, "Ouvrir", () => { _selectedTcg = local.Id; _view = "store"; Render(); }, _accent, 15);
                SetRect(b.GetComponent<RectTransform>(), 0.73f, 0.24f, 0.96f, 0.76f);
            }
        }

        private void RenderStore()
        {
            var c = MakeScroll();
            var tcg = SelectedTcg();
            AddTcgChips(c, tcg);
            if (tcg == null) return;
            AddSectionTitle(c, tcg.Name + " · Boutique");
            var lang = _plugin.LanguageFor(tcg);
            foreach (var set in tcg.Sets.Where(s => s.Languages.Contains(lang)))
            {
                var local = set;
                var card = CreateCard(c, 126f);
                AddText(card.transform, set.Name, 19, TextAnchor.MiddleLeft, _text, FontStyle.Bold, 0.04f, 0.58f, 0.96f, 0.92f);
                AddText(card.transform, set.Cards.Count + " cartes · " + set.Price.ToString("0.00", CultureInfo.InvariantCulture) + "$ · " + _plugin.BoosterCount(set, lang) + " booster(s)", 13, TextAnchor.MiddleLeft, _muted, FontStyle.Normal, 0.04f, 0.37f, 0.96f, 0.60f);
                var buy = CreateButton(card.transform, "Acheter", () => { if (_plugin.BuyBooster(local, lang, out var m)) SetStatus(m); else SetStatus(m); Render(); }, _accent, 14);
                SetRect(buy.GetComponent<RectTransform>(), 0.04f, 0.07f, 0.47f, 0.34f);
                var open = CreateButton(card.transform, "Ouvrir", () => { var pulls = _plugin.OpenBooster(local, lang, out var m); _lastPull = pulls.Count == 0 ? string.Empty : string.Join(" · ", pulls.Select(x => x.Name).ToArray()); SetStatus(m); Render(); }, _surface2, 14);
                SetRect(open.GetComponent<RectTransform>(), 0.53f, 0.07f, 0.96f, 0.34f);
            }
            if (!string.IsNullOrEmpty(_lastPull))
            {
                AddParagraph(c, "Dernier booster : " + _lastPull);
            }
        }

        private void RenderCollection()
        {
            var c = MakeScroll();
            var tcg = SelectedTcg();
            AddTcgChips(c, tcg);
            if (tcg == null) return;
            var lang = _plugin.LanguageFor(tcg);
            AddSectionTitle(c, tcg.Name + " · Collection " + lang);
            foreach (var set in tcg.Sets.Where(s => s.Languages.Contains(lang)))
            {
                int unique = _plugin.OwnedUnique(set, lang);
                int total = _plugin.OwnedTotal(set, lang);
                var card = CreateCard(c, 95f);
                AddText(card.transform, set.Name, 18, TextAnchor.MiddleLeft, _text, FontStyle.Bold, 0.04f, 0.50f, 0.96f, 0.90f);
                AddText(card.transform, unique + "/" + set.Cards.Count + " différentes · " + total + " cartes", 14, TextAnchor.MiddleLeft, unique == set.Cards.Count && set.Cards.Count > 0 ? _good : _muted, FontStyle.Normal, 0.04f, 0.12f, 0.96f, 0.50f);
            }
        }

        private void RenderLanguages()
        {
            var c = MakeScroll();
            AddSectionTitle(c, "Langues");
            AddParagraph(c, "La langue est une variante de collection : FR, EN et JP sont comptées séparément lorsqu'elles existent.");
            foreach (var tcg in _plugin.Tcgs)
            {
                var card = CreateCard(c, 112f);
                AddText(card.transform, tcg.Name, 18, TextAnchor.MiddleLeft, _text, FontStyle.Bold, 0.04f, 0.55f, 0.96f, 0.90f);
                float x = 0.04f;
                foreach (var lang in tcg.Languages)
                {
                    var localTcg = tcg; var localLang = lang;
                    var selected = string.Equals(_plugin.LanguageFor(tcg), lang, StringComparison.OrdinalIgnoreCase);
                    var b = CreateButton(card.transform, lang, () => { _plugin.SetLanguage(localTcg, localLang); SetStatus(localTcg.Name + " : " + localLang); Render(); }, selected ? _accent : _surface2, 13);
                    SetRect(b.GetComponent<RectTransform>(), x, 0.10f, Mathf.Min(x + 0.18f, 0.96f), 0.46f);
                    x += 0.20f;
                }
            }
        }

        private void RenderEmpty()
        {
            var c = MakeScroll();
            AddSectionTitle(c, "Aucun catalogue");
            AddParagraph(c, "Le dossier BepInEx/plugins/MultiTCG/Data ne contient aucun fichier .mtcg valide.");
        }

        private TcgDef SelectedTcg()
        {
            var tcg = _plugin.Tcgs.FirstOrDefault(t => string.Equals(t.Id, _selectedTcg, StringComparison.OrdinalIgnoreCase));
            if (tcg == null && _plugin.Tcgs.Count > 0) { tcg = _plugin.Tcgs[0]; _selectedTcg = tcg.Id; }
            return tcg;
        }

        private void AddTcgChips(RectTransform parent, TcgDef selected)
        {
            var row = CreateRect("TcgRow", parent, new Color(0,0,0,0));
            row.AddComponent<LayoutElement>().preferredHeight = 48f;
            float count = Mathf.Max(1, _plugin.Tcgs.Count);
            for (int i = 0; i < _plugin.Tcgs.Count; i++)
            {
                var tcg = _plugin.Tcgs[i]; var local = tcg;
                var b = CreateButton(row.transform, tcg.Name, () => { _selectedTcg = local.Id; Render(); }, selected != null && selected.Id == tcg.Id ? _accent : _surface2, 13);
                SetRect(b.GetComponent<RectTransform>(), i / count, 0.08f, (i + 1) / count, 0.92f);
            }
        }

        private GameObject CreateCard(RectTransform parent, float height)
        {
            var card = CreateRect("Card", parent, _surface);
            card.AddComponent<LayoutElement>().preferredHeight = height;
            return card;
        }

        private void AddSectionTitle(RectTransform parent, string text)
        {
            var go = new GameObject("SectionTitle", typeof(RectTransform), typeof(Text), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = text; t.fontSize = 23; t.fontStyle = FontStyle.Bold; t.color = _text; t.alignment = TextAnchor.MiddleLeft;
            go.GetComponent<LayoutElement>().preferredHeight = 54f;
        }

        private void AddParagraph(RectTransform parent, string text)
        {
            var go = new GameObject("Paragraph", typeof(RectTransform), typeof(Text), typeof(LayoutElement));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = text; t.fontSize = 14; t.color = _muted; t.alignment = TextAnchor.UpperLeft; t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            go.GetComponent<LayoutElement>().preferredHeight = 66f;
        }

        private void SetStatus(string s)
        {
            if (_status != null) _status.text = s;
        }

        private Font FindFont()
        {
            foreach (var t in Resources.FindObjectsOfTypeAll<Text>()) if (t != null && t.font != null) return t.font;
            try { return Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch { return null; }
        }

        private GameObject CreateRect(string name, Transform parent, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(CanvasRenderer), typeof(Image));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = color;
            return go;
        }

        private Text CreateText(Transform parent, string value, int size, TextAnchor anchor, Color color, FontStyle style)
        {
            var go = new GameObject("Text", typeof(RectTransform), typeof(CanvasRenderer), typeof(Text));
            go.transform.SetParent(parent, false);
            var t = go.GetComponent<Text>(); t.font = _font; t.text = value; t.fontSize = size; t.alignment = anchor; t.color = color; t.fontStyle = style; t.raycastTarget = false;
            return t;
        }

        private void AddText(Transform parent, string value, int size, TextAnchor anchor, Color color, FontStyle style, float x0, float y0, float x1, float y1)
        {
            var t = CreateText(parent, value, size, anchor, color, style);
            SetRect(t.rectTransform, x0, y0, x1, y1);
        }

        private Button CreateButton(Transform parent, string label, Action action, Color color, int fontSize)
        {
            var go = CreateRect("Button_" + label, parent, color);
            var button = go.AddComponent<Button>();
            var cb = button.colors; cb.normalColor = Color.white; cb.highlightedColor = new Color(1.05f,1.05f,1.05f,1f); cb.pressedColor = new Color(0.82f,0.82f,0.82f,1f); button.colors = cb;
            if (action != null) button.onClick.AddListener(() => action());
            var t = CreateText(go.transform, label, fontSize, TextAnchor.MiddleCenter, _text, FontStyle.Bold);
            Stretch(t.rectTransform, 0f, 0f, 1f, 1f);
            return button;
        }

        private static void Stretch(RectTransform r, float x0, float y0, float x1, float y1)
        {
            r.anchorMin = new Vector2(x0, y0); r.anchorMax = new Vector2(x1, y1); r.offsetMin = Vector2.zero; r.offsetMax = Vector2.zero; r.localScale = Vector3.one;
        }

        private static void SetRect(RectTransform r, float x0, float y0, float x1, float y1)
        {
            Stretch(r, x0, y0, x1, y1);
        }

        private static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--) UnityEngine.Object.Destroy(t.GetChild(i).gameObject);
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
            Set(spec, "AppId", appId); Set(spec, "DisplayName", displayName); Set(spec, "Icon", icon); Set(spec, "InnerBackground", null); Set(spec, "OuterBackground", null); Set(spec, "OnClick", onClick);
            var method = registry.GetType().GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic).FirstOrDefault(m => m.Name == "Register" && m.GetParameters().Length == 1);
            if (method == null) return false;
            method.Invoke(registry, new[] { spec });
            _registry = registry;
            return true;
        }

        internal static void Notify(string appId, string msg)
        {
            try { if (!TryGetRegistry(out var r)) return; var m = r.GetType().GetMethods().FirstOrDefault(x => x.Name == "ShowNotification" && x.GetParameters().Length == 2); m?.Invoke(r, new object[] { appId, msg }); } catch { }
        }

        internal static void ClearBadge(string appId)
        {
            try { if (!TryGetRegistry(out var r)) return; var m = r.GetType().GetMethods().FirstOrDefault(x => x.Name == "SetBadgeCount" && x.GetParameters().Length == 2); m?.Invoke(r, new object[] { appId, 0 }); } catch { }
        }

        private static bool TryGetRegistry(out object registry)
        {
            if (_registry != null) { registry = _registry; return true; }
            var api = FindType("PhoneOverhaulAPI");
            if (api == null) { registry = null; return false; }
            var p = api.GetProperty("Registry", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            var f = api.GetField("Registry", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
            registry = p != null ? p.GetValue(null, null) : f?.GetValue(null);
            if (registry != null) _registry = registry;
            return registry != null;
        }

        private static Type FindType(string name)
        {
            foreach (var a in AppDomain.CurrentDomain.GetAssemblies())
            {
                try { foreach (var t in a.GetTypes()) if (t != null && t.Name == name) return t; }
                catch (ReflectionTypeLoadException ex) { foreach (var t in ex.Types) if (t != null && t.Name == name) return t; }
                catch { }
            }
            return null;
        }

        private static void Set(object target, string name, object value)
        {
            var t = target.GetType();
            var p = t.GetProperty(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic); if (p != null && p.CanWrite) { p.SetValue(target, value, null); return; }
            t.GetField(name, BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic)?.SetValue(target, value);
        }
    }

    internal static class GameEconomy
    {
        internal static bool TrySpend(float amount, out string message)
        {
            if (amount <= 0) { message = "Achat validé."; return true; }
            if (TryMoney(out var current) && current + 0.001f < amount) { message = "Pas assez d'argent."; return false; }
            try
            {
                var evtType = Find("CEventPlayer_ReduceCoin"); var manager = Find("CEventManager");
                if (evtType == null || manager == null) { message = "Système d'argent introuvable."; return false; }
                object evt = null;
                foreach (var args in new[] { new object[] { Mathf.CeilToInt(amount), true }, new object[] { amount, true }, new object[] { Mathf.CeilToInt(amount) }, new object[] { amount } })
                { try { evt = Activator.CreateInstance(evtType, args); if (evt != null) break; } catch { } }
                if (evt == null) { message = "Transaction incompatible."; return false; }
                var q = manager.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic).FirstOrDefault(m => m.Name == "QueueEvent" && m.GetParameters().Length == 1);
                if (q == null) { message = "Transaction indisponible."; return false; }
                q.Invoke(null, new[] { evt }); message = "Achat validé."; return true;
            }
            catch (Exception ex) { MultiTcgPhoneNativePlugin.Log?.LogError("Money transaction failed: " + ex); message = "Erreur de transaction."; return false; }
        }

        private static bool TryMoney(out float value)
        {
            value = 0; var type = Find("CPlayerData"); if (type == null) return false;
            var flags = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic;
            foreach (var member in type.GetMembers(flags))
            {
                if (member.Name.IndexOf("coin", StringComparison.OrdinalIgnoreCase) < 0 && member.Name.IndexOf("money", StringComparison.OrdinalIgnoreCase) < 0) continue;
                try { object raw = member is FieldInfo fi ? fi.GetValue(null) : member is PropertyInfo pi && pi.GetIndexParameters().Length == 0 ? pi.GetValue(null, null) : null; if (raw != null) { value = Convert.ToSingle(raw, CultureInfo.InvariantCulture); return true; } } catch { }
            }
            return false;
        }

        private static Type Find(string name)
        {
            foreach (var a in AppDomain.CurrentDomain.GetAssemblies()) try { var t = a.GetTypes().FirstOrDefault(x => x.Name == name); if (t != null) return t; } catch { }
            return null;
        }
    }

    internal sealed class Catalog
    {
        internal readonly List<TcgDef> Tcgs = new List<TcgDef>();
        internal void FinalizeData() { foreach (var t in Tcgs) { t.Languages = t.Languages.Distinct(StringComparer.OrdinalIgnoreCase).ToList(); foreach (var s in t.Sets) s.Languages = s.Languages.Distinct(StringComparer.OrdinalIgnoreCase).ToList(); } }
        internal TcgDef Tcg(string id) => Tcgs.FirstOrDefault(t => string.Equals(t.Id, id, StringComparison.OrdinalIgnoreCase));
        internal SetDef Set(string id) => Tcgs.SelectMany(t => t.Sets).FirstOrDefault(s => string.Equals(s.Id, id, StringComparison.OrdinalIgnoreCase));
    }

    internal sealed class TcgDef { internal string Id; internal string Name; internal List<string> Languages = new List<string>(); internal List<SetDef> Sets = new List<SetDef>(); }
    internal sealed class SetDef
    {
        internal string Id; internal string Name; internal float Price; internal List<string> Languages = new List<string>(); internal List<CardDef> Cards = new List<CardDef>();
        internal CardDef Roll()
        {
            if (Cards.Count == 0) return null;
            float roll = UnityEngine.Random.value * 100f; string rarity = roll < 5f ? "Epic" : roll < 25f ? "Rare" : "Common";
            var pool = Cards.Where(c => string.Equals(c.Rarity, rarity, StringComparison.OrdinalIgnoreCase)).ToList();
            if (pool.Count == 0) pool = Cards;
            return pool[UnityEngine.Random.Range(0, pool.Count)];
        }
    }
    internal sealed class CardDef { internal string Id; internal int Number; internal string Name; internal string Rarity; }

    internal static class CatalogParser
    {
        internal static void Load(string path, Catalog catalog, ManualLogSource log)
        {
            foreach (var raw in File.ReadAllLines(path))
            {
                var line = raw.Trim(); if (line.Length == 0 || line.StartsWith("#")) continue;
                var p = line.Split('|');
                try
                {
                    if (p.Length >= 4 && p[0] == "TCG")
                    {
                        var t = catalog.Tcg(p[1]); if (t == null) { t = new TcgDef { Id = p[1], Name = p[2] }; catalog.Tcgs.Add(t); }
                        t.Languages.AddRange(SplitCsv(p[3]));
                    }
                    else if (p.Length >= 6 && p[0] == "SET")
                    {
                        var t = catalog.Tcg(p[1]); if (t == null) continue;
                        if (!float.TryParse(p[4], NumberStyles.Float, CultureInfo.InvariantCulture, out var price)) price = 4f;
                        var s = new SetDef { Id = p[2], Name = p[3], Price = price }; s.Languages.AddRange(SplitCsv(p[5])); t.Sets.Add(s);
                    }
                    else if (p.Length >= 6 && p[0] == "CARD")
                    {
                        var s = catalog.Set(p[1]); if (s == null) continue; int.TryParse(p[3], out var n); s.Cards.Add(new CardDef { Id = p[2], Number = n, Name = p[4], Rarity = p[5] });
                    }
                }
                catch (Exception ex) { log.LogWarning("Ignored catalog line in " + Path.GetFileName(path) + ": " + ex.Message); }
            }
        }

        private static IEnumerable<string> SplitCsv(string value) => value.Split(',').Select(x => x.Trim().ToUpperInvariant()).Where(x => x.Length > 0);
    }

    internal sealed class PlayerState
    {
        private readonly Dictionary<string, int> _boosters = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, int> _cards = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        private static string B(string set, string lang) => set + "|" + lang;
        private static string C(string set, string lang, string card) => set + "|" + lang + "|" + card;
        internal int BoosterCount(string set, string lang) => _boosters.TryGetValue(B(set, lang), out var n) ? n : 0;
        internal int CardCount(string set, string lang, string card) => _cards.TryGetValue(C(set, lang, card), out var n) ? n : 0;
        internal void AddBooster(string set, string lang, int n) => SetBooster(set, lang, BoosterCount(set, lang) + n);
        internal void AddCard(string set, string lang, string card, int n) => SetCard(set, lang, card, CardCount(set, lang, card) + n);
        internal void SetBooster(string set, string lang, int n) { _boosters[B(set, lang)] = Math.Max(0, n); }
        internal void SetCard(string set, string lang, string card, int n) { _cards[C(set, lang, card)] = Math.Max(0, n); }
        internal IEnumerable<string> Export()
        {
            foreach (var kv in _boosters) { var p = kv.Key.Split('|'); yield return "BOOSTER|" + p[0] + "|" + p[1] + "|" + kv.Value; }
            foreach (var kv in _cards) { var p = kv.Key.Split('|'); yield return "CARD|" + p[0] + "|" + p[1] + "|" + p[2] + "|" + kv.Value; }
        }
    }
}
