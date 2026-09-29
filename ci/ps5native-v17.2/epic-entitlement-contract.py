#!/usr/bin/env python3
import argparse,json
from pathlib import Path
TARGET="dakar desert rally"
def items(o):
    if isinstance(o,list): return o
    if isinstance(o,dict):
        for k in ("library","games","items"):
            if isinstance(o.get(k),list): return o[k]
    return []
def main():
    ap=argparse.ArgumentParser();ap.add_argument("--library-json",required=True);ap.add_argument("--out",required=True);a=ap.parse_args()
    games=items(json.loads(Path(a.library_json).read_text(encoding="utf-8-sig")));m=[]
    for g in games:
        if not isinstance(g,dict): continue
        title=g.get("app_title") or g.get("title") or g.get("name") or g.get("display_name")
        app=g.get("app_name") or g.get("app")
        if title and TARGET in " ".join(str(title).lower().split()): m.append({"title":str(title),"app_name":app})
    exact=[x for x in m if " ".join(x["title"].lower().split())==TARGET];sel=(exact or m)
    sel=sel[0] if sel else None
    r={"status":"ENTITLED" if sel and sel.get("app_name") else "NOT_ENTITLED","selected":sel,"purchase_attempted":False,"credential_exported":False}
    Path(a.out).write_text(json.dumps(r),encoding="utf-8");print("V172_EPIC_ENTITLEMENT_"+r["status"])
    return 0 if r["status"]=="ENTITLED" else 30
if __name__=="__main__": raise SystemExit(main())
