#!/usr/bin/env python3
"""产生「本机版」单一档案：把图示和所有录音嵌进 HTML，双击就能用、不需要网络。

用法：python3 tools/build-local.py [输出路径]
预设输出：dist/注音教室.html
每次网页版更新后重跑一次，再把产出的档案交给使用者。
"""
import base64, os, sys, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', '注音教室.html')

def b64(path, mime):
    with open(os.path.join(ROOT, path), 'rb') as f:
        return 'data:%s;base64,%s' % (mime, base64.b64encode(f.read()).decode())

s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

def rep(old, new):
    global s
    if s.count(old) != 1:
        sys.exit('找不到要替换的段落（index.html 结构变了？）：' + old[:60])
    s = s.replace(old, new)

# 1. 图示改成内嵌
img = b64('DF.png', 'image/png')
s = s.replace('href="DF.png"', 'href="%s"' % img).replace('src="DF.png"', 'src="%s"' % img)
# 2. 本机版不需要 PWA 安装与离线快取
rep('<link rel="manifest" href="manifest.webmanifest">\n', '')
s = re.sub(r"\n[^\n]*navigator\.serviceWorker\.register\([^\n]*", '\n', s, count=1)
# 3. 把录音嵌进去（按键、背诵、整词）
files = []
for sub in ('keys', 'recite', 'words'):
    d = os.path.join(ROOT, 'audio', sub)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        if name.endswith('.enc'):
            files.append('audio/%s/%s' % (sub, name))
embed = 'const EMBED_AUDIO={\n' + ''.join('"%s":"%s",\n' % (f, b64(f, 'application/octet-stream')) for f in files) + '};\n'
rep("const AUDIO_VER=", embed + "const AUDIO_VER=")
rep("function audioUrl(path){ path=String(path).replace(/\\.mp3$/,'.enc');",
    "function audioUrl(path){ path=String(path).replace(/\\.mp3$/,'.enc'); const clean=path.split('?')[0]; if(EMBED_AUDIO[clean]) return EMBED_AUDIO[clean];")

os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w', encoding='utf-8') as f:
    f.write(s)
print('已产生 %s（内嵌 %d 个录音，%.1f MB）' % (out, len(files), os.path.getsize(out) / 1e6))
