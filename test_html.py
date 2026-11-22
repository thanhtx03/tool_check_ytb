import urllib.request
import re
import json

url = 'https://www.youtube.com/channel/UCrRq-nH45cqKL5N79RZ9Ukw'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8'
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

print('HTML length:', len(html))

# Look for video count patterns in the HTML
matches1 = re.findall(r'(\d[\d,\.]*\s*(?:N|Tr|M|K)?\s*video)', html, re.I)
print('matches1:', set(matches1))

# Check for ytInitialData
m = re.search(r'var ytInitialData\s*=\s*({.+?});</script>', html)
if not m:
    m = re.search(r'window\["ytInitialData"\]\s*=\s*({.+?});</script>', html)

if m:
    data_str = m.group(1)
    print('Found ytInitialData! Length:', len(data_str))
    data = json.loads(data_str)
    header = data.get('header', {})
    print('Header keys:', list(header.keys()))
    vm = header.get('pageHeaderRenderer', {}).get('content', {}).get('pageHeaderViewModel', {})
    print('pageHeaderViewModel title:', vm.get('title', {}).get('dynamicTextViewModel', {}).get('text', {}).get('content'))
    metadata = vm.get('metadata', {}).get('contentMetadataViewModel', {})
    print('metadata:', json.dumps(metadata, ensure_ascii=False, indent=2))
else:
    print('ytInitialData not found')

