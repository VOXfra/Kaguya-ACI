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
    public sealed class MultiTcgPhoneReflectionPlugin : BaseUnityPlugin
    {
        public const string PluginGuid = "fr.vox.multitcg.core";
        public const string PluginName = "MultiTCG";
        public const string PluginVersion = "0.3.0";
        private const string AppId = "MultiTCG";

        internal static ManualLogSource Log;
        private readonly CatalogR _catalog = new CatalogR();
        private readonly PlayerR _player = new PlayerR();
        private readonly Dictionary<string, string> _langs = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        private PhoneUiR _ui;
        private bool _registered;

        private string Root => Path.Combine(Paths.PluginPath, "MultiTCG");
        private string DataRoot => Path.Combine(Root, "Data");
        private string SavePath => Path.Combine(Application.persistentDataPath, "MultiTCG", "save_v3.txt");

        private void Awake()
        {
            Log = Logger;
            Directory.CreateDirectory(DataRoot);
            LoadCatalog();
            LoadSave();
            Logger.LogInfo("MultiTCG v0.3.0 loaded: native phone-only UI, no F8/OnGUI window, no Tetramon replacement.");
        }

        private IEnumerator Start()
        {
            for (int i = 0; i < 1200 && !_registered; i++)
            {
                if (PhoneApiR.TryRegister(AppId, "MultiTCG", "MultiTCG", OnPhoneClick))
                {
                    _registered = true;
                    Logger.LogInfo("Phone Overhaul detected: MultiTCG app registered.");
                    yield break;
                }
                yield return null;
            }
            Logger.LogError("Phone Overhaul API not found. v0.3 has intentionally no external fallback window.");
        }

        private void OnPhoneClick()
        {
            try
            {
                PhoneApiR.Badge(AppId, 0);
                if (_ui == null) _ui = new PhoneUiR(this);
                if (!_ui.Open())
                {
                    Logger.LogError("MultiTCG icon clicked but phone content RectTransform was not found.");
                    PhoneApiR.Notify(AppId, "Écran Phone Overhaul introuvable. Envoie LogOutput.log.");
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Native phone UI open failed: " + ex);
                PhoneApiR.Notify(AppId, "Erreur MultiTCG. Vérifie LogOutput.log.");
            }
        }

        internal IList<TcgR> Tcgs => _catalog.Tcgs;
        internal string Lang(TcgR t)
        {
            if (t == null) return "FR";
            if (_langs.TryGetValue(t.Id, out var l) && t.Langs.Contains(l)) return l;
            l = t.Langs.Contains("FR") ? "FR" : (t.Langs.Count > 0 ? t.Langs[0] : "FR");
            _langs[t.Id] = l;
            return l;
        }
        internal void SetLang(TcgR t, string l) { if (t != null && t.Langs.Contains(l)) { _langs[t.Id] = l; Save(); } }
        internal int Boosters(SetR s, string l) => _player.Boosters(s.Id, l);
        internal int Unique(SetR s, string l) => s.Cards.Count(c => _player.Cards(s.Id, l, c.Id) > 0);
        internal int Total(SetR s, string l) => s.Cards.Sum(c => _player.Cards(s.Id, l, c.Id));

        internal bool Buy(SetR s, string l, out string msg)
        {
            if (!EconomyR.TrySpend(s.Price, out msg)) return false;
            _player.AddBooster(s.Id, l, 1); Save(); msg = "Booster acheté."; return true;
        }

        internal List<CardR> Open(SetR s, string l, out string msg)
        {
            var result = new List<CardR>();
            if (_player.Boosters(s.Id, l) <= 0) { msg = "Aucun booster à ouvrir."; return result; }
            _player.AddBooster(s.Id, l, -1);
            for (int i = 0; i < 7; i++)
            {
                var c = s.Roll(); if (c == null) continue;
                result.Add(c); _player.AddCard(s.Id, l, c.Id, 1);
            }
            Save(); msg = "Booster ouvert : " + result.Count + " cartes."; return result;
        }

        private void LoadCatalog()
        {
            _catalog.Tcgs.Clear();
            try { foreach (var f in Directory.GetFiles(DataRoot, "*.mtcg", SearchOption.AllDirectories)) CatalogParserR.Load(f, _catalog, Logger); }
            catch (Exception ex) { Logger.LogError("Catalog load: " + ex); }
            Logger.LogInfo("Catalog loaded: " + _catalog.Tcgs.Count + " TCG(s), " + _catalog.Tcgs.Sum(t => t.Sets.Count) + " set(s).");
        }

        private void LoadSave()
        {
            try
            {
                if (!File.Exists(SavePath)) return;
                foreach (var raw in File.ReadAllLines(SavePath))
                {
                    var p = raw.Split('|');
                    if (p.Length >= 3 && p[0] == "LANG") _langs[p[1]] = p[2];
                    else if (p.Length >= 4 && p[0] == "BOOSTER" && int.TryParse(p[3], out var b)) _player.SetBooster(p[1], p[2], b);
                    else if (p.Length >= 5 && p[0] == "CARD" && int.TryParse(p[4], out var c)) _player.SetCard(p[1], p[2], p[3], c);
                }
            }
            catch (Exception ex) { Logger.LogError("Save load: " + ex); }
        }

        private void Save()
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(SavePath));
                var lines = new List<string> { "# MultiTCG save v3" };
                lines.AddRange(_langs.Select(k => "LANG|" + k.Key + "|" + k.Value));
                lines.AddRange(_player.Export());
                File.WriteAllLines(SavePath, lines.ToArray());
            }
            catch (Exception ex) { Logger.LogError("Save: " + ex); }
        }
    }

    internal sealed class PhoneUiR
    {
        private readonly MultiTcgPhoneReflectionPlugin _p;
        private readonly UiReflection _ui = new UiReflection();
        private GameObject _root;
        private RectTransform _host;
        private RectTransform _body;
        private Component _status;
        private Font _font;
        private string _view = "home";
        private string _selected;
        private int _page;
        private string _lastPull = "";

        private readonly Color Bg = new Color32(17, 19, 25, 255);
        private readonly Color Surface = new Color32(30, 34, 43, 255);
        private readonly Color Surface2 = new Color32(43, 48, 60, 255);
        private readonly Color Accent = new Color32(108, 91, 255, 255);
        private readonly Color White = new Color32(245, 246, 249, 255);
        private readonly Color Muted = new Color32(170, 177, 190, 255);
        private readonly Color Good = new Color32(91, 207, 139, 255);

        internal PhoneUiR(MultiTcgPhoneReflectionPlugin p) { _p = p; }

        internal bool Open()
        {
            if (!_ui.Ready)
            {
                MultiTcgPhoneReflectionPlugin.Log.LogError("UnityEngine.UI runtime types are not loaded.");
                return false;
            }
            _host = LocateHost();
            if (_host == null) return false;
            if (_root == null || !_root) BuildShell();
            else if (_root.transform.parent != _host) _root.transform.SetParent(_host, false);
            _root.SetActive(true); _root.transform.SetAsLastSibling(); _view = "home"; _page = 0; Render(); return true;
        }

        private RectTransform LocateHost()
        {
            try
            {
                RectTransform icon = null;
                foreach (var o in Resources.FindObjectsOfTypeAll(_ui.TextType))
                {
                    var c = o as Component; if (c == null || !c.gameObject.scene.IsValid()) continue;
                    var text = Convert.ToString(_ui.Get(c, "text")) ?? "";
                    if (string.Equals(text.Trim(), "MultiTCG", StringComparison.OrdinalIgnoreCase)) { icon = c.GetComponent<RectTransform>(); break; }
                }
                if (icon == null)
                {
                    foreach (var r in Resources.FindObjectsOfTypeAll<RectTransform>())
                        if (r != null && r.gameObject.scene.IsValid() && r.name.IndexOf("MultiTCG", StringComparison.OrdinalIgnoreCase) >= 0) { icon = r; break; }
                }

                if (icon != null)
                {
                    Transform p = icon;
                    RectTransform useful = null;
                    while (p != null)
                    {
                        var rt = p as RectTransform;
                        if (rt != null && Mathf.Abs(rt.rect.width) > 220f && Mathf.Abs(rt.rect.height) > 280f) useful = rt;
                        if (_ui.GridType != null && p.GetComponent(_ui.GridType) != null)
                        {
                            var par = p.parent as RectTransform;
                            if (par != null) { LogHost("app grid parent", par); return par; }
                        }
                        if (p.GetComponent<Canvas>() != null && useful != null) break;
                        p = p.parent;
                    }
                    if (useful != null) { LogHost("icon ancestry", useful); return useful; }
                }

                RectTransform best = null; float scoreBest = float.MinValue;
                foreach (var r in Resources.FindObjectsOfTypeAll<RectTransform>())
                {
                    if (r == null || !r.gameObject.scene.IsValid() || !r.gameObject.activeInHierarchy) continue;
                    var path = PathOf(r); if (path.IndexOf("phone", StringComparison.OrdinalIgnoreCase) < 0) continue;
                    float w = Mathf.Abs(r.rect.width), h = Mathf.Abs(r.rect.height); if (w < 220 || h < 280) continue;
                    float score = Mathf.Min(w, 900) + Mathf.Min(h, 1200) + (h >= w ? 100 : 0) + (r.name.IndexOf("screen", StringComparison.OrdinalIgnoreCase) >= 0 ? 250 : 0);
                    if (score > scoreBest) { scoreBest = score; best = r; }
                }
                if (best != null) LogHost("phone hierarchy scan", best);
                return best;
            }
            catch (Exception ex) { MultiTcgPhoneReflectionPlugin.Log.LogError("Locate phone host: " + ex); return null; }
        }

        private static void LogHost(string method, RectTransform r) => MultiTcgPhoneReflectionPlugin.Log.LogInfo("MultiTCG phone host (" + method + "): " + PathOf(r) + " rect=" + r.rect.width + "x" + r.rect.height);
        private static string PathOf(Transform t) { var a = new List<string>(); for (var p=t;p!=null && a.Count<12;p=p.parent)a.Add(p.name); a.Reverse(); return string.Join("/",a.ToArray()); }

        private void BuildShell()
        {
            _font = FindFont();
            _root = _ui.Panel("MultiTCG_NativePhoneApp", _host, Bg); Stretch(_root.GetComponent<RectTransform>(),0,0,1,1); _ui.IgnoreLayout(_root);

            var top = _ui.Panel("Top", _root.transform, Surface); Set(top,0,0.88f,1,1);
            var back = _ui.Button("Back", top.transform, "‹", 30, Surface2, White, () => _root.SetActive(false), _font); Set(back,0.02f,0.10f,0.15f,0.90f);
            var title = _ui.Text("Title", top.transform, "MultiTCG", 26, TextAnchor.MiddleLeft, White, FontStyle.Bold, _font); Set(title.gameObject,0.18f,0.06f,0.98f,0.94f);

            var stat = _ui.Panel("Status", _root.transform, new Color32(22,25,32,255)); Set(stat,0,0.82f,1,0.88f);
            _status = _ui.Text("StatusText", stat.transform, "Prêt", 13, TextAnchor.MiddleCenter, Muted, FontStyle.Normal, _font); Stretch(_status.GetComponent<RectTransform>(),0.02f,0,0.98f,1);

            var body = _ui.Panel("Body", _root.transform, Bg); _body = body.GetComponent<RectTransform>(); Set(body,0,0.13f,1,0.82f);
            var nav = _ui.Panel("Nav", _root.transform, Surface); Set(nav,0,0,1,0.13f);
            var b1=_ui.Button("Store",nav.transform,"Boutique",14,Surface,White,()=>{_view="store";_page=0;Render();},_font);Set(b1,0,0,0.333f,1);
            var b2=_ui.Button("Collection",nav.transform,"Collection",14,Surface,White,()=>{_view="collection";_page=0;Render();},_font);Set(b2,0.333f,0,0.666f,1);
            var b3=_ui.Button("Languages",nav.transform,"Langues",14,Surface,White,()=>{_view="languages";_page=0;Render();},_font);Set(b3,0.666f,0,1,1);
        }

        private Font FindFont()
        {
            try
            {
                foreach (var o in Resources.FindObjectsOfTypeAll(_ui.TextType))
                {
                    var c=o as Component; if(c==null)continue; var f=_ui.Get(c,"font") as Font; if(f!=null)return f;
                }
                return Resources.GetBuiltinResource<Font>("Arial.ttf");
            }
            catch { return null; }
        }

        private void Render()
        {
            Clear(_body); Status("MultiTCG · aucune carte Tetramon remplacée");
            if (_p.Tcgs.Count == 0) { Title("Aucun catalogue",0.82f,0.98f); Subtitle("Aucun .mtcg valide dans BepInEx/plugins/MultiTCG/Data.",0.64f,0.82f); return; }
            if (_view=="store") Store(); else if(_view=="collection") Collection(); else if(_view=="languages") Languages(); else Home();
        }

        private void Home()
        {
            Title("Ta boutique de cartes",0.86f,0.98f);
            Subtitle("Choisis un jeu. Sets et langues restent séparés du contenu vanilla.",0.74f,0.86f);
            var list=_p.Tcgs.Take(3).ToList();
            for(int i=0;i<list.Count;i++)
            {
                float y1=0.70f-i*0.22f,y0=y1-0.19f; var t=list[i];
                var card=Card("TCG_"+t.Id,y0,y1);
                Label(card,t.Name,19,0.04f,0.43f,0.72f,0.88f,White,true);
                Label(card,t.Sets.Count+" collections · "+_p.Lang(t),13,0.04f,0.12f,0.72f,0.45f,Muted,false);
                var b=_ui.Button("Open",card.transform,"Ouvrir",14,Accent,White,()=>{_selected=t.Id;_view="store";_page=0;Render();},_font);Set(b,0.74f,0.24f,0.96f,0.76f);
            }
        }

        private void Store()
        {
            var t=Selected(); Chips(t); if(t==null)return; var lang=_p.Lang(t);
            Title(t.Name+" · "+lang,0.79f,0.88f);
            var sets=t.Sets.Where(s=>s.Langs.Contains(lang)).ToList(); var page=sets.Skip(_page*3).Take(3).ToList();
            for(int i=0;i<page.Count;i++)
            {
                float y1=0.76f-i*0.23f,y0=y1-0.20f; var s=page[i]; var card=Card("Set_"+s.Id,y0,y1);
                Label(card,s.Name,17,0.04f,0.55f,0.96f,0.90f,White,true);
                Label(card,s.Price.ToString("0.00",CultureInfo.InvariantCulture)+"$ · "+_p.Boosters(s,lang)+" booster(s)",12,0.04f,0.38f,0.96f,0.58f,Muted,false);
                var buy=_ui.Button("Buy",card.transform,"Acheter",12,Accent,White,()=>{_p.Buy(s,lang,out var m);Status(m);RenderKeepStatus(m);},_font);Set(buy,0.04f,0.08f,0.47f,0.34f);
                var open=_ui.Button("OpenPack",card.transform,"Ouvrir",12,Surface2,White,()=>{var pulls=_p.Open(s,lang,out var m);_lastPull=pulls.Count>0?string.Join(" · ",pulls.Select(x=>x.Name).ToArray()):"";Status(m);RenderKeepStatus(m);},_font);Set(open,0.53f,0.08f,0.96f,0.34f);
            }
            Pager(sets.Count,3);
            if(!string.IsNullOrEmpty(_lastPull)) Label(_body.gameObject,"Dernier : "+_lastPull,11,0.04f,0.005f,0.96f,0.055f,Muted,false);
        }

        private void Collection()
        {
            var t=Selected(); Chips(t); if(t==null)return; var lang=_p.Lang(t); Title("Collection · "+lang,0.79f,0.88f);
            var sets=t.Sets.Where(s=>s.Langs.Contains(lang)).ToList(); var page=sets.Skip(_page*4).Take(4).ToList();
            for(int i=0;i<page.Count;i++)
            {
                float y1=0.75f-i*0.17f,y0=y1-0.14f;var s=page[i];var card=Card("Coll_"+s.Id,y0,y1);int u=_p.Unique(s,lang),tot=_p.Total(s,lang);
                Label(card,s.Name,16,0.04f,0.48f,0.96f,0.88f,White,true); Label(card,u+"/"+s.Cards.Count+" différentes · "+tot+" cartes",12,0.04f,0.10f,0.96f,0.48f,u==s.Cards.Count&&s.Cards.Count>0?Good:Muted,false);
            }
            Pager(sets.Count,4);
        }

        private void Languages()
        {
            Title("Langues",0.86f,0.98f); Subtitle("Chaque langue compte comme une collection distincte lorsqu'elle existe.",0.74f,0.86f);
            var list=_p.Tcgs.Take(3).ToList();
            for(int i=0;i<list.Count;i++)
            {
                float y1=0.70f-i*0.22f,y0=y1-0.18f;var t=list[i];var card=Card("Lang_"+t.Id,y0,y1);Label(card,t.Name,17,0.04f,0.57f,0.96f,0.90f,White,true);
                float x=0.04f;foreach(var l in t.Langs){var ll=l;var tt=t;bool sel=_p.Lang(t)==l;var b=_ui.Button("L_"+l,card.transform,l,12,sel?Accent:Surface2,White,()=>{_p.SetLang(tt,ll);Status(tt.Name+" : "+ll);RenderKeepStatus(tt.Name+" : "+ll);},_font);Set(b,x,0.10f,Mathf.Min(x+0.19f,0.96f),0.48f);x+=0.21f;}
            }
        }

        private void Chips(TcgR selected)
        {
            float n=Mathf.Max(1,_p.Tcgs.Count);for(int i=0;i<_p.Tcgs.Count;i++){var t=_p.Tcgs[i];var tt=t;float x0=i/n,x1=(i+1)/n;var b=_ui.Button("Chip_"+t.Id,_body,t.Name,11,selected!=null&&selected.Id==t.Id?Accent:Surface2,White,()=>{_selected=tt.Id;_page=0;Render();},_font);Set(b,x0+0.01f,0.90f,x1-0.01f,0.985f);}
        }

        private TcgR Selected(){var t=_p.Tcgs.FirstOrDefault(x=>x.Id==_selected);if(t==null&&_p.Tcgs.Count>0){t=_p.Tcgs[0];_selected=t.Id;}return t;}
        private void Pager(int count,int per){int pages=Mathf.Max(1,Mathf.CeilToInt(count/(float)per));if(pages<=1)return;var prev=_ui.Button("Prev",_body,"‹",18,Surface2,White,()=>{_page=Mathf.Max(0,_page-1);Render();},_font);Set(prev,0.35f,0.005f,0.47f,0.07f);Label(_body.gameObject,(_page+1)+" / "+pages,11,0.47f,0.005f,0.53f,0.07f,Muted,false);var next=_ui.Button("Next",_body,"›",18,Surface2,White,()=>{_page=Mathf.Min(pages-1,_page+1);Render();},_font);Set(next,0.53f,0.005f,0.65f,0.07f);}
        private GameObject Card(string name,float y0,float y1){var g=_ui.Panel(name,_body,Surface);Set(g,0.035f,y0,0.965f,y1);return g;}
        private void Title(string s,float y0,float y1)=>Label(_body.gameObject,s,21,0.04f,y0,0.96f,y1,White,true);
        private void Subtitle(string s,float y0,float y1)=>Label(_body.gameObject,s,12,0.04f,y0,0.96f,y1,Muted,false);
        private void Label(GameObject parent,string s,int size,float x0,float y0,float x1,float y1,Color col,bool bold){var t=_ui.Text("Label",parent.transform,s,size,TextAnchor.MiddleLeft,col,bold?FontStyle.Bold:FontStyle.Normal,_font);Set(t.gameObject,x0,y0,x1,y1);}
        private void Status(string s){if(_status!=null)_ui.Set(_status,"text",s);}
        private void RenderKeepStatus(string s){Render();Status(s);}
        private static void Clear(Transform t){for(int i=t.childCount-1;i>=0;i--)UnityEngine.Object.Destroy(t.GetChild(i).gameObject);}
        private static void Stretch(RectTransform r,float x0,float y0,float x1,float y1){r.anchorMin=new Vector2(x0,y0);r.anchorMax=new Vector2(x1,y1);r.offsetMin=Vector2.zero;r.offsetMax=Vector2.zero;r.localScale=Vector3.one;}
        private static void Set(GameObject g,float x0,float y0,float x1,float y1)=>Stretch(g.GetComponent<RectTransform>(),x0,y0,x1,y1);
    }

    internal sealed class UiReflection
    {
        internal readonly Type ImageType; internal readonly Type TextType; internal readonly Type ButtonType; internal readonly Type GridType; internal readonly Type LayoutElementType;
        internal bool Ready => ImageType!=null&&TextType!=null&&ButtonType!=null;
        internal UiReflection(){ImageType=Find("UnityEngine.UI.Image");TextType=Find("UnityEngine.UI.Text");ButtonType=Find("UnityEngine.UI.Button");GridType=Find("UnityEngine.UI.GridLayoutGroup");LayoutElementType=Find("UnityEngine.UI.LayoutElement");}

        internal GameObject Panel(string name,Transform parent,Color color)
        {
            var g=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer));g.transform.SetParent(parent,false);var img=g.AddComponent(ImageType);Set(img,"color",color);Set(img,"raycastTarget",true);return g;
        }

        internal Component Text(string name,Transform parent,string text,int size,TextAnchor anchor,Color color,FontStyle style,Font font)
        {
            var g=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer));g.transform.SetParent(parent,false);var c=g.AddComponent(TextType);Set(c,"text",text);Set(c,"fontSize",size);Set(c,"alignment",anchor);Set(c,"color",color);Set(c,"fontStyle",style);Set(c,"font",font);Set(c,"raycastTarget",false);Set(c,"horizontalOverflow",HorizontalWrapMode.Wrap);Set(c,"verticalOverflow",VerticalWrapMode.Truncate);return c;
        }

        internal GameObject Button(string name,Transform parent,string label,int size,Color bg,Color fg,Action action,Font font)
        {
            var g=Panel(name,parent,bg);var image=g.GetComponent(ImageType);var b=g.AddComponent(ButtonType);Set(b,"targetGraphic",image);Wire(b,action);var t=Text("Text",g.transform,label,size,TextAnchor.MiddleCenter,fg,FontStyle.Bold,font);var r=t.GetComponent<RectTransform>();r.anchorMin=Vector2.zero;r.anchorMax=Vector2.one;r.offsetMin=Vector2.zero;r.offsetMax=Vector2.zero;return g;
        }

        internal void IgnoreLayout(GameObject g){if(LayoutElementType==null)return;try{var l=g.AddComponent(LayoutElementType);Set(l,"ignoreLayout",true);}catch{}}
        internal object Get(object target,string name){if(target==null)return null;var t=target.GetType();var p=t.GetProperty(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(p!=null)return p.GetValue(target,null);var f=t.GetField(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);return f?.GetValue(target);}
        internal void Set(object target,string name,object value){if(target==null)return;var t=target.GetType();var p=t.GetProperty(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(p!=null&&p.CanWrite){try{p.SetValue(target,value,null);return;}catch{}}var f=t.GetField(name,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(f!=null)try{f.SetValue(target,value);}catch{}}

        private void Wire(Component button,Action action)
        {
            if(button==null||action==null)return;try{var ev=Get(button,"onClick");if(ev==null)return;var add=ev.GetType().GetMethods().FirstOrDefault(m=>m.Name=="AddListener"&&m.GetParameters().Length==1);if(add==null)return;var dt=add.GetParameters()[0].ParameterType;var del=Delegate.CreateDelegate(dt,action.Target,action.Method);add.Invoke(ev,new object[]{del});}catch(Exception ex){MultiTcgPhoneReflectionPlugin.Log?.LogError("Wire phone button: "+ex);}
        }

        private static Type Find(string full){foreach(var a in AppDomain.CurrentDomain.GetAssemblies()){try{var t=a.GetType(full,false);if(t!=null)return t;}catch{}}return null;}
    }

    internal static class PhoneApiR
    {
        private static object _reg;
        internal static bool TryRegister(string id,string name,string icon,Action click)
        {
            if(!Registry(out var r))return false;var spec=FindSimple("AppSpec");if(spec==null)return false;var o=Activator.CreateInstance(spec);Set(o,"AppId",id);Set(o,"DisplayName",name);Set(o,"Icon",icon);Set(o,"InnerBackground",null);Set(o,"OuterBackground",null);Set(o,"OnClick",click);var m=r.GetType().GetMethods(BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic).FirstOrDefault(x=>x.Name=="Register"&&x.GetParameters().Length==1);if(m==null)return false;m.Invoke(r,new[]{o});_reg=r;return true;
        }
        internal static void Notify(string id,string msg){try{if(!Registry(out var r))return;var m=r.GetType().GetMethods().FirstOrDefault(x=>x.Name=="ShowNotification"&&x.GetParameters().Length==2);m?.Invoke(r,new object[]{id,msg});}catch{}}
        internal static void Badge(string id,int n){try{if(!Registry(out var r))return;var m=r.GetType().GetMethods().FirstOrDefault(x=>x.Name=="SetBadgeCount"&&x.GetParameters().Length==2);m?.Invoke(r,new object[]{id,n});}catch{}}
        private static bool Registry(out object r){if(_reg!=null){r=_reg;return true;}var api=FindSimple("PhoneOverhaulAPI");if(api==null){r=null;return false;}var p=api.GetProperty("Registry",BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic);var f=api.GetField("Registry",BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic);r=p!=null?p.GetValue(null,null):f?.GetValue(null);if(r!=null)_reg=r;return r!=null;}
        private static Type FindSimple(string n){foreach(var a in AppDomain.CurrentDomain.GetAssemblies()){try{foreach(var t in a.GetTypes())if(t!=null&&t.Name==n)return t;}catch(ReflectionTypeLoadException e){foreach(var t in e.Types)if(t!=null&&t.Name==n)return t;}catch{}}return null;}
        private static void Set(object o,string n,object v){var t=o.GetType();var p=t.GetProperty(n,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic);if(p!=null&&p.CanWrite){p.SetValue(o,v,null);return;}t.GetField(n,BindingFlags.Instance|BindingFlags.Public|BindingFlags.NonPublic)?.SetValue(o,v);}
    }

    internal static class EconomyR
    {
        internal static bool TrySpend(float amount,out string msg)
        {
            if(amount<=0){msg="Achat validé.";return true;}if(TryRead(out var cash)&&cash+0.001f<amount){msg="Pas assez d'argent.";return false;}
            try{var e=Find("CEventPlayer_ReduceCoin");var m=Find("CEventManager");if(e==null||m==null){msg="Système d'argent introuvable.";return false;}object evt=null;foreach(var a in new[]{new object[]{Mathf.CeilToInt(amount),true},new object[]{amount,true},new object[]{Mathf.CeilToInt(amount)},new object[]{amount}}){try{evt=Activator.CreateInstance(e,a);if(evt!=null)break;}catch{}}if(evt==null){msg="Transaction incompatible.";return false;}var q=m.GetMethods(BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic).FirstOrDefault(x=>x.Name=="QueueEvent"&&x.GetParameters().Length==1);if(q==null){msg="Transaction indisponible.";return false;}q.Invoke(null,new[]{evt});msg="Achat validé.";return true;}catch(Exception ex){MultiTcgPhoneReflectionPlugin.Log?.LogError("Spend: "+ex);msg="Erreur de transaction.";return false;}
        }
        private static bool TryRead(out float v){v=0;var t=Find("CPlayerData");if(t==null)return false;var flags=BindingFlags.Static|BindingFlags.Public|BindingFlags.NonPublic;foreach(var mem in t.GetMembers(flags)){if(mem.Name.IndexOf("coin",StringComparison.OrdinalIgnoreCase)<0&&mem.Name.IndexOf("money",StringComparison.OrdinalIgnoreCase)<0)continue;try{object x=mem is FieldInfo fi?fi.GetValue(null):mem is PropertyInfo pi&&pi.GetIndexParameters().Length==0?pi.GetValue(null,null):null;if(x!=null){v=Convert.ToSingle(x,CultureInfo.InvariantCulture);return true;}}catch{}}return false;}
        private static Type Find(string n){foreach(var a in AppDomain.CurrentDomain.GetAssemblies())try{var t=a.GetTypes().FirstOrDefault(x=>x.Name==n);if(t!=null)return t;}catch{}return null;}
    }

    internal sealed class CatalogR { internal readonly List<TcgR> Tcgs=new List<TcgR>(); internal TcgR Tcg(string id)=>Tcgs.FirstOrDefault(t=>t.Id==id); internal SetR Set(string id)=>Tcgs.SelectMany(t=>t.Sets).FirstOrDefault(s=>s.Id==id); }
    internal sealed class TcgR { internal string Id,Name; internal readonly List<string> Langs=new List<string>(); internal readonly List<SetR> Sets=new List<SetR>(); }
    internal sealed class SetR { internal string Id,Name; internal float Price; internal readonly List<string> Langs=new List<string>(); internal readonly List<CardR> Cards=new List<CardR>(); internal CardR Roll(){if(Cards.Count==0)return null;float r=UnityEngine.Random.value*100;string q=r<5?"Epic":r<25?"Rare":"Common";var p=Cards.Where(c=>string.Equals(c.Rarity,q,StringComparison.OrdinalIgnoreCase)).ToList();if(p.Count==0)p=Cards;return p[UnityEngine.Random.Range(0,p.Count)];} }
    internal sealed class CardR { internal string Id,Name,Rarity; internal int Number; }
    internal static class CatalogParserR
    {
        internal static void Load(string path,CatalogR c,ManualLogSource log){foreach(var raw in File.ReadAllLines(path)){var line=raw.Trim();if(line.Length==0||line.StartsWith("#"))continue;var p=line.Split('|');try{if(p.Length>=4&&p[0]=="TCG"){var t=c.Tcg(p[1]);if(t==null){t=new TcgR{Id=p[1],Name=p[2]};c.Tcgs.Add(t);}foreach(var l in Csv(p[3]))if(!t.Langs.Contains(l))t.Langs.Add(l);}else if(p.Length>=6&&p[0]=="SET"){var t=c.Tcg(p[1]);if(t==null)continue;float.TryParse(p[4],NumberStyles.Float,CultureInfo.InvariantCulture,out var price);var s=new SetR{Id=p[2],Name=p[3],Price=price};foreach(var l in Csv(p[5]))s.Langs.Add(l);t.Sets.Add(s);}else if(p.Length>=6&&p[0]=="CARD"){var s=c.Set(p[1]);if(s==null)continue;int.TryParse(p[3],out var n);s.Cards.Add(new CardR{Id=p[2],Number=n,Name=p[4],Rarity=p[5]});}}catch(Exception ex){log.LogWarning("Catalog line ignored: "+ex.Message);}}}
        private static IEnumerable<string> Csv(string s)=>s.Split(',').Select(x=>x.Trim().ToUpperInvariant()).Where(x=>x.Length>0);
    }
    internal sealed class PlayerR
    {
        private readonly Dictionary<string,int> b=new Dictionary<string,int>(StringComparer.OrdinalIgnoreCase),c=new Dictionary<string,int>(StringComparer.OrdinalIgnoreCase);private static string B(string s,string l)=>s+"|"+l;private static string C(string s,string l,string x)=>s+"|"+l+"|"+x;internal int Boosters(string s,string l)=>b.TryGetValue(B(s,l),out var n)?n:0;internal int Cards(string s,string l,string x)=>c.TryGetValue(C(s,l,x),out var n)?n:0;internal void AddBooster(string s,string l,int n)=>SetBooster(s,l,Boosters(s,l)+n);internal void AddCard(string s,string l,string x,int n)=>SetCard(s,l,x,Cards(s,l,x)+n);internal void SetBooster(string s,string l,int n)=>b[B(s,l)]=Math.Max(0,n);internal void SetCard(string s,string l,string x,int n)=>c[C(s,l,x)]=Math.Max(0,n);internal IEnumerable<string> Export(){foreach(var k in b){var p=k.Key.Split('|');yield return "BOOSTER|"+p[0]+"|"+p[1]+"|"+k.Value;}foreach(var k in c){var p=k.Key.Split('|');yield return "CARD|"+p[0]+"|"+p[1]+"|"+p[2]+"|"+k.Value;}}
    }
}
