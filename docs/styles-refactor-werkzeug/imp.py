import re
src=open('styles.css').read().split('\n')
# track current selector stack (top-level + one nesting for @media)
cur=None; media=None
rows=[]
i=0
for i,line in enumerate(src):
    s=line.rstrip()
    st=s.strip()
    if st.startswith('@media'):
        media=st; continue
    if st=='}' :
        # could close a rule or media; naive: if line has no indent it's top-level rule close
        if not s.startswith(' ') and not s.startswith('\t'):
            cur=None
        continue
    m=re.match(r'^([.#\[:][^{]*?)\s*\{', st)
    if m and '{' in st:
        cur=m.group(1).strip()
    if '!important' in st:
        prop=re.match(r'\s*([a-z-]+)\s*:',st)
        rows.append((i+1, cur or '?', prop.group(1) if prop else '?'))
from collections import defaultdict
bysel=defaultdict(list)
for ln,sel,prop in rows:
    bysel[sel].append((prop,ln))
print(f"{len(rows)} !important in {len(bysel)} Selektoren\n")
for sel,items in sorted(bysel.items(), key=lambda x:-len(x[1])):
    props=', '.join(f"{p}" for p,_ in items)
    lns=f"{items[0][1]}"+(f"..{items[-1][1]}" if len(items)>1 else "")
    print(f"[{len(items):2d}] {sel}  (Z.{lns})\n      {props}")
