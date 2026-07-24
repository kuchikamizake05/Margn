#!/usr/bin/env python3
"""Find demo targets: agents the platform marks onlineStatus=1 ("online")
whose A2MCP endpoint is actually dead when probed live. Those are the strongest
verify() demo cases — the platform flag says online, the probe says otherwise.

Run on a machine with real internet (not the sandbox):
    python3 find-dead-demo-target.py

Reads the newest agents-*.json in this folder. Probes with POST (some endpoints
are POST-only), 5s timeout, mirroring the Worker's verify() behavior.
"""
import json, glob, os, ssl, urllib.request, socket, collections

HERE = os.path.dirname(os.path.abspath(__file__))
raw = sorted(glob.glob(os.path.join(HERE, "agents-*.json")))[-1]
agents = json.load(open(raw))["agents"]
agents = agents if isinstance(agents, list) else list(agents.values())

# One probeable A2MCP endpoint per agent, only where platform says online.
targets = collections.OrderedDict()
for a in agents:
    if a.get("onlineStatus") != 1:
        continue
    for s in a.get("services", []):
        ep = s.get("endpoint")
        stype = s.get("serviceType") or s.get("type")
        if ep and str(stype).upper() in ("A2MCP", "2") and a["agentId"] not in targets:
            targets[a["agentId"]] = (a.get("name", "?"), s.get("serviceName", "?"), ep)

print(f"probing {len(targets)} online-flagged A2MCP endpoints (POST, 5s)\n")
ctx = ssl.create_default_context()
dead = []
for aid, (name, svc, ep) in targets.items():
    try:
        req = urllib.request.Request(
            ep, data=b'{"probe":true,"source":"margn"}',
            headers={"content-type": "application/json",
                     "user-agent": "Margn-Liveness-Probe/1.0"}, method="POST")
        code = urllib.request.urlopen(req, timeout=5, context=ctx).status
        verdict = "ok" if code in (200, 402) else f"http {code}"
    except urllib.error.HTTPError as e:
        code, verdict = e.code, ("ok" if e.code in (200, 402) else f"http {e.code}")
    except (urllib.error.URLError, socket.timeout, ssl.SSLError, ConnectionError) as e:
        code, verdict = None, "DEAD"
        dead.append((aid, name, svc, ep, type(e).__name__))
    if verdict == "DEAD":
        print(f"  DEAD  #{aid:6} {name[:24]:24} {ep}")

print(f"\n{len(dead)} online-flagged agents are actually unreachable.")
print("These are your demo targets: platform says online, verify() proves dead.")
if dead:
    best = dead[0]
    print(f"\nTop pick: agent #{best[0]} ({best[1]}) — {best[4]}")
    print(f"Confirm live during demo:")
    print(f"  curl -sS -X POST https://margn.margnhq.workers.dev/v1/verify \\")
    print(f"    -H 'content-type: application/json' -d '{{\"agentId\":\"{best[0]}\"}}'")
