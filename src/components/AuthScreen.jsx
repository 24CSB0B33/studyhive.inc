import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

export default function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (signup) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name.trim() });
        await credential.user.getIdToken(true);
      } else await signInWithEmailAndPassword(auth, email, password);
    } catch (err) { setError(err.message.replace('Firebase: ', '')); }
    finally { setBusy(false); }
  };
  return <main className="page auth-page"><section className="card-sleek paper-page auth-card"><span className="section-eyebrow">A QUIETER PLACE TO LEARN</span><h1>{signup ? 'Make your study nook.' : 'Welcome back.'}</h1><p>Sign in to find your people, save your interests, and study together.</p><form className="form-stack" onSubmit={submit}>{signup && <div className="field"><label className="field-label">Your name</label><input required value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="e.g. Mira Sharma" /></div>}<div className="field"><label className="field-label">Email</label><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" /></div><div className="field"><label className="field-label">Password</label><input required minLength="6" type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={signup?'new-password':'current-password'} /></div>{error && <div className="alert alert-danger">{error}</div>}<button className="btn-primary" disabled={busy}>{busy?'One moment…':signup?'Create account':'Sign in'}</button></form><button className="btn-ghost" onClick={()=>{setSignup(!signup);setError('')}}>{signup?'Already have an account? Sign in':'New to StudyHive? Create an account'}</button></section></main>;
}
