import json, re, numpy as np, wave, sys, onnxruntime as ort, espeakng_loader
from phonemizer.backend.espeak.wrapper import EspeakWrapper
EspeakWrapper.set_library(espeakng_loader.get_library_path()); EspeakWrapper.set_data_path(espeakng_loader.get_data_path())
from phonemizer.backend import EspeakBackend
M='../models/vits-piper-pt_BR-dii-high/'
cfg=json.load(open(M+'pt_BR-dii-high.onnx.json')); idmap=cfg['phoneme_id_map']
sess=ort.InferenceSession(M+'pt_BR-dii-high.onnx')
be=EspeakBackend('pt-br',preserve_punctuation=True,with_stress=True)
ls=float(sys.argv[1]) if len(sys.argv)>1 else 1.0
ns=float(sys.argv[2]) if len(sys.argv)>2 else 0.667
nw=float(sys.argv[3]) if len(sys.argv)>3 else 0.8
prefix=sys.argv[4] if len(sys.argv)>4 else 'p'
lines={'v0':"Promoção imperdível!",'v1':"Smirnoff Ice, por apenas nove reais!",'v4':"Long neck!",
       'v2':"Só esse mês, na Tabadega dos Caiçaras.",'v3':"Compartilhe com aquela pessoa que não pode perder essa oferta!"}
fix={'Smirnoff':'Ismírnof','Ice':'Áice','Long neck':'Lóng néc','Tabadega':'Tabadéga'}
for k,t in lines.items():
    for a,b in fix.items(): t=t.replace(a,b)
    ph=be.phonemize([t],strip=True)[0]
    ph=re.sub('ɾə','ɾ',ph).replace('ˈaɪsy','ˈaɪs')
    ids=[1,0]
    for c in ph:
        if c in idmap: ids+=idmap[c]+[0]
    ids+=[2]
    out=sess.run(None,{'input':np.array([ids],np.int64),'input_lengths':np.array([len(ids)],np.int64),'scales':np.array([ns,ls,nw],np.float32)})[0].reshape(-1)
    s=out; idx=np.where(np.abs(s)>0.01)[0]; s=s[max(idx[0]-200,0):idx[-1]+1200]
    w=wave.open(f'{k}.wav','wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes((np.clip(s/np.abs(s).max()*0.9,-1,1)*32767).astype(np.int16).tobytes()); w.close()
    print(k, round(len(s)/22050,2), ph)
