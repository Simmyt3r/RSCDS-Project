#!/usr/bin/env python3
"""Optional supervised classifier training on independently verified labelled pixel/patch features.
Input CSV: area_id,label,veg_loss,brightness_gain,ndbi_gain,post_ndvi.
Labels 1=settlement-like-change, 0=non-settlement-change. Not a deployment trigger.
"""
import argparse,csv,json,pathlib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from sklearn.metrics import classification_report,confusion_matrix
import joblib
COLS=('veg_loss','brightness_gain','ndbi_gain','post_ndvi')
def train(csv_path,out):
    with open(csv_path,newline='') as fh:rows=list(csv.DictReader(fh))
    if len(rows)<100:raise ValueError('Need at least 100 independently labelled samples')
    x=np.array([[float(r[k]) for k in COLS] for r in rows]);y=np.array([int(r['label']) for r in rows]);g=np.array([r['area_id'] for r in rows]);
    if len(set(g))<5 or len(set(y))<2:raise ValueError('Need both classes and at least five independent study areas')
    split=GroupShuffleSplit(n_splits=1,test_size=.25,random_state=42)
    train_idx,test_idx=next(split.split(x,y,g))
    if len(set(y[train_idx]))<2 or len(set(y[test_idx]))<2:raise ValueError('Group split leaves a class absent; collect more diverse labels')
    model=RandomForestClassifier(n_estimators=150,min_samples_leaf=4,class_weight='balanced',random_state=42)
    model.fit(x[train_idx],y[train_idx]);pred=model.predict(x[test_idx])
    stats={'n_train':len(train_idx),'n_test':len(test_idx),'held_out_areas':sorted(set(g[test_idx])),'features':COLS,'report':classification_report(y[test_idx],pred,output_dict=True,zero_division=0),'confusion_matrix':confusion_matrix(y[test_idx],pred,labels=[0,1]).tolist(),'warning':'Held-out evaluation is not proof of field performance. Geographic transfer testing needed.'}
    out=pathlib.Path(out);out.parent.mkdir(parents=True,exist_ok=True);joblib.dump(model,out);out.with_suffix('.metrics.json').write_text(json.dumps(stats,indent=2))
    print(json.dumps(stats,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('labels_csv');p.add_argument('--out',default='outputs/rf_candidate_classifier.joblib');a=p.parse_args();train(a.labels_csv,a.out)
