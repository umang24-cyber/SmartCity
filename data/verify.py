import socket, requests, json

HOSTNAME = 'tg-955b4acb-5d72-46eb-a8f4-420628df0978.tg-3452941248.i.tgcloud.io'
TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwYWxha21pdHRhbC5idDI1Y3NlZHNAcGVjLmVkdS5pbiIsImlhdCI6MTc3NTExMzA3NiwiZXhwIjoxNzgyODg5MDgxLCJpc3MiOiJUaWdlckdyYXBoIn0.qDivaGPN9N9nRCwDnepSqgXNyjF76yo1ABmLMngEHXg'
IP = '3.109.145.130'

_orig = socket.getaddrinfo
def _patch(host, port, *a, **k):
    if host == HOSTNAME:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (IP, port or 443))]
    return _orig(host, port, *a, **k)
socket.getaddrinfo = _patch

H = {'Authorization': 'Bearer ' + TOKEN}
BASE = 'https://' + HOSTNAME + '/restpp'

for vtype in ['Intersection','Incident','SafetyFeature','PoliceStation','SafetyCluster','TimeSlice']:
    r = requests.get(f'{BASE}/graph/UrbanSafetyGraph/vertices/{vtype}?limit=5', headers=H, timeout=15)
    d = r.json()
    results = d.get('results', [])
    print(f'{vtype}: {len(results)} samples | error={d.get("error", False)}')
