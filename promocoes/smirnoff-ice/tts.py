import re, numpy as np, wave, sys, onnxruntime as ort, espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper
EspeakWrapper.set_library(espeakng_loader.get_library_path()); EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
from phonemizer import phonemize
M='../models/kokoro-multi-lang-v1_0/'
vocab={}
for l in open(M+'tokens.txt',encoding='utf8'):
    l=l.rstrip('\n'); 
    if not l: continue
    tok,i=l.rsplit(' ',1); vocab[tok if tok else ' ']=int(i)
voices=np.fromfile(M+'voices.bin',dtype=np.float32).reshape(54,510,256)
sess=ort.InferenceSession(M+'model.onnx')
lines=["Promoção imperdível!","Smirnoff Ice, por apenas nove reais! Long neck!","Só esse mês, na Tabadega dos Caiçaras.","Compartilhe com aquela pessoa que não pode perder essa oferta!"]
fix={'Smirnoff':'Ismírnof','Ice':'Aice','Long neck':'Lóng néc','Tabadega':'Tabadéga'}
sid=int(sys.argv[1]) if len(sys.argv)>1 else 42; sp=float(sys.argv[2]) if len(sys.argv)>2 else 1.1
for i,t in enumerate(lines):
    for k,v in fix.items(): t=t.replace(k,v)
    ph=phonemize(t,language='pt-br',backend='espeak',preserve_punctuation=True,with_stress=True).strip()
    ph=re.sub('ɾə','ɾ',ph).replace('ˈaɪsy','ˈaɪs')
    ids=[vocab[c] for c in ph if c in vocab]
    miss=set(c for c in ph if c not in vocab)
    style=voices[sid][len(ids)][None]
    a=sess.run(None,{'tokens':np.array([[0]+ids+[0]],np.int64),'style':style,'speed':np.array([sp],np.float32)})[0].reshape(-1)
    idx=np.where(np.abs(a)>0.01)[0]; a=a[max(idx[0]-200,0):idx[-1]+1200]
    w=wave.open(f'v{i}.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(24000)
    w.writeframes((np.clip(a/np.abs(a).max()*0.9,-1,1)*32767).astype(np.int16).tobytes()); w.close()
    print(i,round(len(a)/24000,2),ph,miss)
