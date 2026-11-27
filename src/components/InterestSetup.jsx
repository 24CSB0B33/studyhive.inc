import React, { useMemo, useState } from 'react';
import { allTopics } from '../data/topics';
import { saveProfile } from '../services/api';

export default function InterestSetup({ user, onComplete }) {
  const [name,setName]=useState(user.displayName||''); const [query,setQuery]=useState(''); const [selected,setSelected]=useState([]); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const matches=useMemo(()=>allTopics.filter(t=>t.toLowerCase().includes(query.toLowerCase())).slice(0,80),[query]);
  const toggle=(t)=>setSelected(s=>s.includes(t)?s.filter(x=>x!==t):[...s,t]);
  const submit=async(e)=>{e.preventDefault();if(!selected.length){setError('Choose at least one topic to shape your room suggestions.');return}setBusy(true);try{const result=await saveProfile({name:name.trim(),interests:selected});if(!result.success)throw new Error(result.message||'Could not save your profile');onComplete(result.profile)}catch(err){setError(err.message)}finally{setBusy(false)}};
  return <main className="page auth-page"><section className="card-sleek paper-page interest-card"><span className="section-eyebrow">YOUR STUDY SHELF</span><h1>What are you curious about?</h1><p>Pick a few subjects. We’ll use them to bring relevant public rooms to your lobby.</p><form onSubmit={submit} className="form-stack"><div className="field"><label className="field-label">Name shown in rooms</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" /></div><div className="field"><label className="field-label">Find a topic</label><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Try: organic chemistry, UPSC, guitar…" /></div><div className="topic-cloud">{matches.map(t=><button type="button" key={t} className={`pill ${selected.includes(t)?'active':''}`} onClick={()=>toggle(t)}>{t}</button>)}</div><small>{selected.length} interests selected</small>{error&&<div className="alert alert-danger">{error}</div>}<button className="btn-primary" disabled={busy}>{busy?'Saving…':'Find my study rooms'}</button></form></section></main>;
}
