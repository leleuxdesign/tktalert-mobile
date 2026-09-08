import sys, struct, hashlib, glob, os

def read_utf(d, i):
    (n,) = struct.unpack(">H", d[i:i+2]); i += 2
    return d[i:i+n].decode("utf-8", "replace"), i + n

def certs_from_jks(path):
    d = open(path, "rb").read()
    if d[:4] != b"\xfe\xed\xfe\xed":
        return None, "not a JKS file"
    i = 4
    (_ver,) = struct.unpack(">I", d[i:i+4]); i += 4
    (count,) = struct.unpack(">I", d[i:i+4]); i += 4
    out = []
    for _ in range(count):
        (tag,) = struct.unpack(">I", d[i:i+4]); i += 4
        alias, i = read_utf(d, i)
        i += 8  # creation timestamp
        if tag == 1:  # private key entry
            (klen,) = struct.unpack(">I", d[i:i+4]); i += 4 + klen
            (nchain,) = struct.unpack(">I", d[i:i+4]); i += 4
        else:         # trusted cert entry
            nchain = 1
        for _c in range(nchain):
            _ctype, i = read_utf(d, i)
            (clen,) = struct.unpack(">I", d[i:i+4]); i += 4
            der = d[i:i+clen]; i += clen
            out.append((alias, hashlib.sha1(der).hexdigest().upper()))
    return out, None

LIVE = "DC5724D412E755CCC95F2D8032D5D169A05D47BC"
DEAD = "45DDA27A74027057AFC79101C3758E2E564C7571"

paths = sorted(set(glob.glob(os.path.expanduser("~/Development/Apps/TKTAlert/tktalert-mobile/*.jks")) +
                   glob.glob(os.path.expanduser("~/Development/Apps/TKTAlert/tktalert-mobile/credentials/*.jks"))))
for p in paths:
    res, err = certs_from_jks(p)
    name = p.replace(os.path.expanduser("~/Development/Apps/TKTAlert/tktalert-mobile/"), "")
    if err:
        print(f"  {name}: {err}"); continue
    for alias, fp in res:
        pretty = ":".join(fp[j:j+2] for j in range(0, len(fp), 2))
        verdict = "✅ LIVE KEY (XlucZPR00I — signs the AAB)" if fp == LIVE else ("❌ DEAD KEY (deleted keystore)" if fp == DEAD else "⚠️  UNKNOWN key")
        print(f"  {name}")
        print(f"      alias {alias[:16]}…  SHA-1 {pretty}")
        print(f"      {verdict}")
