"""Add animated upper-spine and anatomical forearm sockets to player exports."""
import importlib.util,json,math
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('c',Path(__file__).parent/'convert-assets.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
_,bones,_=c.parse(c.SOURCE/'Player'/'player.bmd')
axis=np.array([[1,0,0],[0,0,1],[0,-1,0]])
for hero in ['knight','wizard','elf']:
    for suffix in ['', '-armor']:
        path=c.OUT/'models'/f'{hero}{suffix}.json'
        data=json.loads(path.read_text(encoding='utf-8'))
        frames=[None]*max(clip['start']+clip['count'] for clip in data['clips'].values())
        bind=None
        bind_mats=None
        left_frames=[None]*len(frames);right_frames=[None]*len(frames)
        for label,clip in data['clips'].items():
            action=clip['sourceAction']
            keys=len(bones[18][1][action][0])
            for i in range(clip['count']):
                mats=c.matrices(bones,action,i*(keys-1)/clip['count'])
                if label!='idle':
                    offset=mats[0][:2,3].copy()
                    for m in mats:m[:2,3]-=offset
                if bind_mats is None:bind_mats=mats
                index=clip['start']+i
                left_frames[index]=[round(float(v),6) for v in c.forearm_socket(mats,'left',bind_mats).T.flatten()]
                right_frames[index]=[round(float(v),6) for v in c.forearm_socket(mats,'right',bind_mats).T.flatten()]
                native=mats[18]
                if bind is None:bind=native[:3,:3].copy()
                out=np.eye(4)
                out[:3,:3]=axis@native[:3,:3]@bind.T@axis.T
                out[:3,3]=axis@native[:3,3]/100
                frames[clip['start']+i]=[round(float(v),6) for v in out.T.flatten()]
        data['sockets']['torso']=frames
        data['sockets']['forearmLeft']=left_frames
        data['sockets']['forearmRight']=right_frames
        path.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8')
        print(hero+suffix,'attachment sockets',len(frames),'frames')
