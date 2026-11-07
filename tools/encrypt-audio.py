#!/usr/bin/env python3
"""把原始 mp3 录音加密成 .enc，放进网站的 audio/ 资料夹（网站播放时会自动解密）。

用法：python3 tools/encrypt-audio.py <原始录音资料夹>
  原始录音资料夹里要有 keys/、recite/、words/ 子资料夹，里面放 mp3。
  原始 mp3 不要放进 GitHub；只上传加密后的 .enc。
金钥藏在 index.html 的 _ZK_A / _ZK_B 里（本脚本会自动读出）。
"""
import os, re, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_key():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    A = [int(x) for x in re.search(r'const _ZK_A=\[([\d,]+)\]', s).group(1).split(',')]
    B = [int(x) for x in re.search(r'const _ZK_B=\[([\d,]+)\]', s).group(1).split(',')]
    return bytes(A[i] ^ B[31 - i] ^ ((i * 73 + 41) & 255) for i in range(32))

def main(src):
    aes = AESGCM(load_key())
    n = 0
    for sub in ('keys', 'recite', 'words'):
        d = os.path.join(src, sub)
        if not os.path.isdir(d):
            continue
        os.makedirs(os.path.join(ROOT, 'audio', sub), exist_ok=True)
        for name in sorted(os.listdir(d)):
            if not name.lower().endswith('.mp3'):
                continue
            data = open(os.path.join(d, name), 'rb').read()
            iv = os.urandom(12)
            out = os.path.join(ROOT, 'audio', sub, name[:-4] + '.enc')
            open(out, 'wb').write(iv + aes.encrypt(iv, data, None))
            n += 1
    print('已加密 %d 个录音' % n)

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
