import re
from collections import defaultdict
src=open('styles.css').read().split('\n')
blocks=[]; i=0; n=len(src)
while i<n:
    line=src[i]
    if line and line[0] not in ' \t/}' and '{' in line:
        sel=line.split('{')[0].strip()
        if line.rstrip().endswith('}'):
            body=line.split('{',1)[1].rsplit('}',1)[0]
            props=[p.strip() for p in body.split(';') if p.strip()]
            blocks.append((sel,i+1,i+1,props)); i+=1; continue
        j=i+1; body=[]
        while j<n and not src[j].startswith('}'):
            body.append(src[j]); j+=1
        joined=' '.join(body); joined=re.sub(r'/\*.*?\*/','',joined)
        props=[p.strip() for p in joined.split(';') if p.strip()]
        blocks.append((sel,i+1,j+1,props)); i=j+1; continue
    i+=1
def keys(props): return set(p.split(':')[0].strip() for p in props if ':' in p)
bysel=defaultdict(list)
for b in blocks: bysel[b[0]].append(b)
for sel,bs in sorted(bysel.items()):
    if len(bs)<2: continue
    # only simple single-class/id selectors (no space/comma/combinator) to focus
    if any(c in sel for c in ' >,+~:'): continue
    kk=[keys(b[3]) for b in bs]
    allk=set().union(*kk)
    # conflict = a property key in >=2 blocks
    from collections import Counter
    cnt=Counter()
    for k in kk: cnt.update(k)
    conflicts=[k for k,c in cnt.items() if c>1]
    locs=[(b[1],b[2]) for b in bs]
    tag="DISJUNKT" if not conflicts else f"KONFLIKT:{conflicts}"
    print(f"{sel:28s} {locs}  {tag}")
