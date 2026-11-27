import React, { useCallback, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import Navbar from './components/Navbar';
import Lobby from './components/Lobby';
import StudyRoom from './components/StudyRoom';
import GeminiKeyModal from './components/GeminiKeyModal';
import AuthScreen from './components/AuthScreen';
import InterestSetup from './components/InterestSetup';
import { auth, firebaseConfigured } from './firebase';
import { fetchRooms, getProfile, setAuthToken, setRoomInviteToken } from './services/api';
import { getSocket } from './services/socket';

function App() {
  const [user,setUser]=useState(null); const [profile,setProfile]=useState(null); const [authReady,setAuthReady]=useState(false); const [profileReady,setProfileReady]=useState(false); const [rooms,setRooms]=useState([]); const [currentRoomId,setCurrentRoomId]=useState(null); const [inviteToken,setInviteToken]=useState('');
  const [selectedModel,setSelectedModel]=useState(()=>{const saved=localStorage.getItem('studyhive_gemini_model');return saved==='gemini-1.5-flash'||saved==='gemini-2.0-flash'||saved==='gemini-1.5-pro'||!saved?'gemini-3.8-flash':saved}); const [isGeminiModalOpen,setIsGeminiModalOpen]=useState(false);
  useEffect(()=>{ if(!auth) {setAuthReady(true);setProfileReady(true);return undefined} return onIdTokenChanged(auth,async(next)=>{setUser(next);setProfile(null);setProfileReady(!next);setAuthReady(true);if(!next){setAuthToken(null);getSocket(null);return}const cacheKey=`studyhive_profile_${next.uid}`;try{const token=await next.getIdToken();setAuthToken(token);getSocket(token);const result=await getProfile();if(result.success&&result.profile){setProfile(result.profile);localStorage.setItem(cacheKey,JSON.stringify(result.profile));setProfileReady(true);return}}catch(err){console.warn('Could not load profile from server:',err.message)}try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached?.name&&cached?.interests?.length)setProfile(cached)}catch{localStorage.removeItem(cacheKey)}finally{setProfileReady(true)}},)},[]);
  const loadInitialData=useCallback(async()=>{try{const res=await fetchRooms();if(res.success)setRooms(res.rooms||[])}catch(err){console.warn('Could not load rooms:',err.message)}},[]);
  useEffect(()=>{if(!profile)return;loadInitialData();const params=new URLSearchParams(window.location.search);if(params.get('join')){const token=params.get('invite')||'';setCurrentRoomId(params.get('join'));setInviteToken(token);setRoomInviteToken(token)}},[profile,loadInitialData]);
  useEffect(()=>{if(!user)return;const s=getSocket();const update=(list)=>setRooms(list);s.on('rooms-updated',update);return()=>s.off('rooms-updated',update)},[user]);
  const socket=user?getSocket():null;
  if(!firebaseConfigured)return <main className="page auth-page"><section className="card-sleek paper-page auth-card"><span className="section-eyebrow">A SMALL SETUP FIRST</span><h1>Connect StudyHive to Firebase</h1><p>Add the Firebase web app settings to your local <code>.env</code> file to enable account sign in. The setup steps are in the project README.</p></section></main>;
  if(!authReady)return <main className="page auth-page"><p>Opening your study nook…</p></main>;
  if(!user)return <AuthScreen/>;
  if(!profileReady)return <main className="page auth-page"><p>Loading your saved profile…</p></main>;
  if(!profile)return <InterestSetup user={user} onComplete={setProfile}/>;
  const currentRoom=rooms.find(r=>r.id===currentRoomId);
  const leave=()=>{setCurrentRoomId(null);setInviteToken('');setRoomInviteToken('');const clean=window.location.origin+window.location.pathname;window.history.replaceState({},'',clean);};
  const join=(id,invite='')=>{setCurrentRoomId(id);setInviteToken(invite);setRoomInviteToken(invite)};
  return <div className="app-shell"><Navbar currentUser={{...profile,id:user.uid,avatar:'🎓'}} currentRoom={currentRoom} onLeaveRoom={leave} onSignOut={()=>signOut(auth)}/><main style={{flex:1}}>{currentRoomId?<StudyRoom key={currentRoomId} roomId={currentRoomId} inviteToken={inviteToken} currentUser={{...profile,id:user.uid,avatar:'🎓'}} socket={socket} onLeaveRoom={leave} onRoomDeleted={()=>{leave();loadInitialData()}} selectedModel={selectedModel} onOpenGeminiModal={()=>setIsGeminiModalOpen(true)}/>:<Lobby rooms={rooms} onJoinRoom={join} onRefreshRooms={loadInitialData} currentUser={{...profile,id:user.uid,avatar:'🎓'}}/>}</main><GeminiKeyModal isOpen={isGeminiModalOpen} onClose={()=>setIsGeminiModalOpen(false)} selectedModel={selectedModel} onSelectModel={m=>{setSelectedModel(m);localStorage.setItem('studyhive_gemini_model',m)}}/><footer className="app-footer"><div className="app-footer-inner"><span><strong>StudyHive</strong> · Collaborative study rooms</span><span>AI Settings · <button onClick={()=>setIsGeminiModalOpen(true)} className="footer-link">Preferences</button></span></div></footer></div>;
}
export default App;
