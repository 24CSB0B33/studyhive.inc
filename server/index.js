
require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');

const store = require('./storage');
const { generateQuizWithGemini } = require('./quizAgent');
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

let adminAuth = null; let profileDb = null;
try {
  if (process.env.FIREBASE_PROJECT_ID) {
    if (!getApps().length) {
      const credentialPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS || '');
      const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf8'));
      if (serviceAccount.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('Firebase service account project does not match FIREBASE_PROJECT_ID.');
      initializeApp({ credential: cert(serviceAccount), projectId: process.env.FIREBASE_PROJECT_ID });
    }
    adminAuth = getAuth(); profileDb = getFirestore();
  }
} catch (error) { console.error('[Firebase Admin] Initialization failed; configure FIREBASE_PROJECT_ID and GOOGLE_APPLICATION_CREDENTIALS.'); }

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.SERVER_PORT || 5000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function getJoinedUser(roomId, userId) {
  for (const client of io.sockets.sockets.values()) {
    if (client.rooms.has(roomId) && client.data.user?.id === userId) {
      return client.data.user;
    }
  }
  return null;
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '1d' }));

async function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!adminAuth || !token) return res.status(503).json({ success: false, message: 'Firebase server authentication is not configured.' });
  try { req.user = await adminAuth.verifyIdToken(token); next(); }
  catch { res.status(401).json({ success: false, message: 'Please sign in again.' }); }
}
async function getProfile(uid) {
  if (!profileDb) return null;
  const doc = await profileDb.collection('profiles').doc(uid).get(); return doc.exists ? doc.data() : null;
}
function canAccessRoom(room, uid, invite) {
  return room && (room.visibility !== 'private' || room.hostId === uid || (invite && invite === room.inviteToken));
}
function publicRoom(room) { const { inviteToken, ...safe } = room; return safe; }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'application/vnd.openxmlformats-officedocument.presentationml.presentation' 
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: PDF, images, text, docx, pptx'));
    }
  }
});

let cloudinaryConfigured = false;
let cloudinary = null;

try {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_KEY !== 'your_api_key' &&
    process.env.CLOUDINARY_API_SECRET &&
    process.env.CLOUDINARY_API_SECRET !== 'your_api_secret'
  ) {
    const cloudinaryModule = require('cloudinary').v2;
    cloudinaryModule.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    cloudinary = cloudinaryModule;
    cloudinaryConfigured = true;
    console.log('[Cloudinary] Configured successfully');
  } else {
    console.log('[Cloudinary] Not configured — add credentials to .env to enable file uploads');
  }
} catch (err) {
  console.warn('[Cloudinary] Module load failed:', err.message);
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'StudyHive',
    tagline: 'A real-time collaborative learning platform',
    groupMembers: [
      { name: 'B Vikranth', rollNo: '24CSB0B12' },
      { name: 'K Chandan', rollNo: '24CSB0B33' }
    ],
    cloudinary: cloudinaryConfigured,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/profile/me', requireAuth, async (req,res)=>{const profile=await getProfile(req.user.uid);res.json({success:true,profile:profile||null})});
app.put('/api/profile/me', requireAuth, async (req,res)=>{if(!profileDb)return res.status(503).json({success:false,message:'Firebase profile storage is not configured.'});const name=String(req.body.name||'').trim().slice(0,80);const interests=Array.isArray(req.body.interests)?[...new Set(req.body.interests.map(x=>String(x).trim()).filter(Boolean))].slice(0,100):[];if(!name||!interests.length)return res.status(400).json({success:false,message:'Name and at least one interest are required.'});const profile={uid:req.user.uid,name,email:req.user.email||'',interests,updatedAt:new Date().toISOString()};await profileDb.collection('profiles').doc(req.user.uid).set(profile,{merge:true});res.json({success:true,profile})});

app.get('/api/rooms', requireAuth, async (req, res) => {
  const profile=await getProfile(req.user.uid); const rooms=store.getRooms().filter(r=>r.visibility!=='private'||r.hostId===req.user.uid).map(publicRoom);
  const interests=profile?.interests||[]; rooms.sort((a,b)=>{const score=r=>interests.reduce((n,t)=>n+(`${r.topic} ${r.category} ${r.title} ${r.description}`.toLowerCase().includes(t.toLowerCase())?1:0),0);return score(b)-score(a)});
  res.json({ success: true, rooms });
});

app.get('/api/rooms/:id', requireAuth, (req, res) => {
  const room = store.getRoom(req.params.id);
  if (!room || !canAccessRoom(room, req.user.uid, req.query.invite)) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  res.json({ success: true, room: room.hostId===req.user.uid ? room : publicRoom(room) });
});

app.post('/api/rooms', requireAuth, async (req, res) => {
  const { title, description, topic, category, visibility } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  const profile=await getProfile(req.user.uid);if(!profile)return res.status(400).json({success:false,message:'Complete your profile before creating a room.'});
  const newRoom = store.createRoom({ title, description, topic, category, hostId:req.user.uid, hostName:profile.name, visibility });
  io.emit('rooms-updated', store.getRooms().filter(r=>r.visibility!=='private').map(publicRoom));
  res.status(201).json({ success: true, room: newRoom });
});
app.delete('/api/rooms/:id', requireAuth, (req,res)=>{const room=store.getRoom(req.params.id);if(!room)return res.status(404).json({success:false,message:'Room not found.'});if(room.hostId!==req.user.uid)return res.status(403).json({success:false,message:'Only the room creator can delete it.'});store.deleteRoom(room.id);io.to(room.id).emit('room-deleted',{roomId:room.id});io.emit('rooms-updated',store.getRooms().filter(r=>r.visibility!=='private').map(publicRoom));res.json({success:true})});

app.get('/api/rooms/:id/messages', requireAuth, (req, res) => {
  const room=store.getRoom(req.params.id);if(!canAccessRoom(room,req.user.uid,req.query.invite))return res.status(404).json({success:false,message:'Room not found or invite required.'});
  const messages = store.getMessages(req.params.id);
  res.json({ success: true, messages });
});

app.get('/api/rooms/:roomId/resources', requireAuth, (req, res) => {
  const room=store.getRoom(req.params.roomId);if(!canAccessRoom(room,req.user.uid,req.query.invite))return res.status(404).json({success:false,message:'Room not found or invite required.'});
  if (!store.getRoom(req.params.roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  const { tag, search } = req.query;
  const resources = store.getResources(req.params.roomId, tag, search);
  res.json({ success: true, resources });
});

app.post('/api/rooms/:roomId/resources', requireAuth, (req, res) => {
  const { title, description, content, tags, category, uploaderId, fileUrl, fileName, fileType, fileSize } = req.body;
  const roomId = req.params.roomId;
  const room = store.getRoom(roomId);
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  const participant = getJoinedUser(roomId, req.user.uid);
  if (!participant) {
    return res.status(403).json({ success: false, message: 'Join this room before adding a resource.' });
  }
  if (!title) {
    return res.status(400).json({ success: false, message: 'Resource title is required' });
  }
  const resource = store.addResource({
    roomId,
    title,
    description,
    content,
    tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()) : ['General']),
    category,
    uploaderId: participant.id,
    uploaderName: participant.name,
    fileUrl: fileUrl || null,
    fileName: fileName || null,
    fileType: fileType || null,
    fileSize: fileSize || null
  });
  io.to(roomId).emit('resource-added', resource);
  res.status(201).json({ success: true, resource });
});

app.post('/api/rooms/:roomId/resources/:id/vote', requireAuth, (req, res) => {
  const { voteType } = req.body; const userId=req.user.uid;
  const { roomId } = req.params;
  if (!store.getRoom(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }
  if (!getJoinedUser(roomId, userId)) {
    return res.status(403).json({ success: false, message: 'Join this room before voting.' });
  }
  if (!['up', 'down'].includes(voteType)) {
    return res.status(400).json({ success: false, message: 'voteType must be "up" or "down"' });
  }
  const resource = store.voteResource(roomId, req.params.id, userId, voteType);
  if (!resource) {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }
  io.to(roomId).emit('resource-voted', resource);
  res.json({ success: true, resource });
});

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided' });
  }

  const { roomId } = req.body; const userId=req.user.uid;
  if (!store.getRoom(roomId)) {
    return res.status(404).json({ success: false, message: 'Room not found' });
  }
  if (!userId || !getJoinedUser(roomId, userId)) {
    return res.status(403).json({ success: false, message: 'Join this room before uploading a file.' });
  }

  const storeLocally = async (reason) => {
    const extension = path.extname(req.file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 12);
    const filename = `${crypto.randomUUID()}${extension}`;
    await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), req.file.buffer, { flag: 'wx' });
    console.warn(`[Upload] Using local storage${reason ? ` after Cloudinary error: ${reason}` : ''}`);
    res.json({
      success: true,
      fileUrl: `${req.protocol}://${req.get('host')}/uploads/${filename}`,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      storage: 'local'
    });
  };

  try {
    if (!cloudinaryConfigured || !cloudinary) return await storeLocally('Cloudinary is not configured');
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'studyhive',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(req.file.buffer);
    });

    res.json({
      success: true,
      fileUrl: result.secure_url,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      publicId: result.public_id
    });
  } catch (err) {
    console.error('[Upload] Cloudinary error:', err);
    try { await storeLocally(err.message); }
    catch (localError) {
      console.error('[Upload] Local storage error:', localError);
      res.status(500).json({ success: false, message: 'Cloud upload failed and local storage could not save the file.' });
    }
  }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.message && err.message.includes('File type not allowed')) {
    return res.status(415).json({ success: false, message: err.message });
  }
  next(err);
});

app.post('/api/quiz/generate', async (req, res) => {
  try {
    const { topic, notesContext, difficulty, questionCount, model } = req.body;
    const keyToUse = process.env.GEMINI_API_KEY;

    const quizResult = await generateQuizWithGemini({
      topic,
      notesContext,
      difficulty: difficulty || 'Medium',
      questionCount: parseInt(questionCount, 10) || 5,
      apiKey: keyToUse,
      model: model || 'gemini-3.8-flash'
    });

    res.json(quizResult);
  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate quiz with AI agent'
    });
  }
});

app.post('/api/quiz/test-key', async (req, res) => {
  const keyToTest = process.env.GEMINI_API_KEY;

  if (!keyToTest) {
    return res.status(400).json({ success: false, message: 'No GEMINI_API_KEY set in server .env.' });
  }

  try {
    let lastError = null;
    for (const model of ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash']) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keyToTest}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the word "PONG" only.' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      });
      if (response.ok) return res.json({ success: true, message: `Gemini API key is active. ${model} responded.` });
      const err = await response.json().catch(() => ({}));
      lastError = { status: response.status, message: err.error?.message || `Gemini returned HTTP ${response.status}.` };
      console.error(`[QuizAgent] Key test failed on ${model}:`, response.status, lastError.message);
      if (![404, 429, 500, 502, 503, 504].includes(response.status)) break;
    }
    res.status(lastError?.status || 500).json({ success: false, message: lastError?.message || 'Gemini key test failed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

setInterval(() => {
  const rooms = store.rooms;
  for (const roomId in rooms) {
    const room = rooms[roomId];
    if (room && room.pomodoro && room.pomodoro.isRunning) {
      room.pomodoro.timeLeft -= 1;

      if (room.pomodoro.timeLeft <= 0) {
        if (room.pomodoro.mode === 'work') {
          room.pomodoro.cyclesCompleted += 1;
          if (room.pomodoro.cyclesCompleted % 4 === 0) {
            room.pomodoro.mode = 'longBreak';
            room.pomodoro.timeLeft = 15 * 60;
          } else {
            room.pomodoro.mode = 'shortBreak';
            room.pomodoro.timeLeft = 5 * 60;
          }
        } else {
          room.pomodoro.mode = 'work';
          room.pomodoro.timeLeft = room.pomodoro.workDuration || 25 * 60;
        }

        io.to(roomId).emit('pomodoro-phase-completed', {
          roomId,
          newMode: room.pomodoro.mode,
          timeLeft: room.pomodoro.timeLeft,
          cyclesCompleted: room.pomodoro.cyclesCompleted
        });
      }

      io.to(roomId).emit('pomodoro-tick', {
        roomId,
        timeLeft: room.pomodoro.timeLeft,
        mode: room.pomodoro.mode,
        isRunning: room.pomodoro.isRunning,
        cyclesCompleted: room.pomodoro.cyclesCompleted
      });
    }
  }
}, 1000);


io.use(async (socket,next)=>{try{const token=socket.handshake.auth?.token;if(!adminAuth||!token)throw new Error('Sign in required');const decoded=await adminAuth.verifyIdToken(token);const profile=await getProfile(decoded.uid);if(!profile)throw new Error('Complete your profile first');socket.data.identity={id:decoded.uid,name:profile.name,avatar:'🎓',role:'Scholar'};next()}catch(error){next(new Error('Authentication required'))}});
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('join-room', ({ roomId, inviteToken },ack=()=>{}) => {
    const room=store.getRoom(roomId);const user=socket.data.identity;
    if(!canAccessRoom(room,user.id,inviteToken)){ack({success:false,message:'Room is private or invitation is invalid.'});return}
    socket.data.roomId=roomId;socket.data.user=user;
    socket.join(roomId);
    ack({success:true});

    if (user && user.id) {
      store.addParticipant(roomId, user);
      const room = store.getRoom(roomId);
      io.to(roomId).emit('room-participants-updated', {
        roomId,
        participants: room ? room.participants : []
      });

      const systemMsg = {
        id: 'sys-' + Date.now(),
        roomId,
        senderId: 'system',
        senderName: 'StudyHive Sentinel',
        senderAvatar: '🐝',
        role: 'System',
        content: `${user.name} joined the hive room.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      io.to(roomId).emit('new-message', systemMsg);
    }

    const currentRoom = store.getRoom(roomId);
    if (currentRoom) {
      socket.emit('room-state-sync', currentRoom);
    }
  });

  socket.on('leave-room', ({ roomId }) => {
    if(socket.data.roomId!==roomId)return;
    socket.leave(roomId);
    store.removeParticipant(roomId, socket.data.user.id);socket.data.roomId=null;
    const room = store.getRoom(roomId);
    if (room) {
      io.to(roomId).emit('room-participants-updated', {
        roomId,
        participants: room.participants
      });
    }
  });

  socket.on('send-message', ({ roomId, message }) => {
    if(socket.data.roomId!==roomId)return;
    const savedMsg = store.addMessage(roomId, {...message,senderId:socket.data.user.id,senderName:socket.data.user.name,senderAvatar:socket.data.user.avatar});
    io.to(roomId).emit('new-message', savedMsg);
  });

  socket.on('pomodoro-control', ({ roomId, action, mode, customMinutes }) => {
    if(socket.data.roomId!==roomId)return;
    const room = store.getRoom(roomId);
    if (!room) return;
    if (socket.data.user?.id !== room.hostId) {
      socket.emit('pomodoro-control-denied', { roomId, message: 'Only the room host can control the timer.' });
      return;
    }

    if (action === 'start') {
      room.pomodoro.isRunning = true;
    } else if (action === 'pause') {
      room.pomodoro.isRunning = false;
    } else if (action === 'reset') {
      room.pomodoro.isRunning = false;
      if (room.pomodoro.mode === 'work') {
        room.pomodoro.timeLeft = room.pomodoro.workDuration || 25 * 60;
      } else if (room.pomodoro.mode === 'shortBreak') {
        room.pomodoro.timeLeft = room.pomodoro.breakDuration || 5 * 60;
      } else {
        room.pomodoro.timeLeft = 15 * 60;
      }
    } else if (action === 'switch-mode') {
      room.pomodoro.mode = mode || 'work';
      room.pomodoro.isRunning = false;
      if (room.pomodoro.mode === 'work') {
        room.pomodoro.timeLeft = (customMinutes ? customMinutes * 60 : 25 * 60);
        room.pomodoro.workDuration = room.pomodoro.timeLeft;
      } else if (room.pomodoro.mode === 'shortBreak') {
        room.pomodoro.timeLeft = 5 * 60;
      } else if (room.pomodoro.mode === 'longBreak') {
        room.pomodoro.timeLeft = 15 * 60;
      }
    }

    io.to(roomId).emit('pomodoro-update', {
      roomId,
      pomodoro: room.pomodoro
    });
  });

  socket.on('start-room-quiz', ({ roomId, quizData, initiatedBy }) => {
    if(socket.data.roomId!==roomId)return;
    const room = store.getRoom(roomId);
    if (room) {
      room.activeQuiz = {
        id: 'quiz-' + Date.now(),
        ...quizData,
        initiatedBy,
        scores: {},
        status: 'active',
        startedAt: new Date().toISOString()
      };

      io.to(roomId).emit('room-quiz-started', {
        roomId,
        quiz: room.activeQuiz
      });

      const announceMsg = {
        id: 'sys-quiz-' + Date.now(),
        roomId,
        senderId: 'ai-agent',
        senderName: 'HiveBrain AI',
        senderAvatar: '🧠',
        role: 'AI Agent',
        content: `⚡ AI Quiz started: "${quizData.topic}" (${quizData.questions?.length || 5} questions). Everyone can answer together!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      io.to(roomId).emit('new-message', announceMsg);
    }
  });

  socket.on('submit-quiz-score', ({ roomId, quizId, user, score, totalQuestions }) => {
    if(socket.data.roomId!==roomId)return;
    const room = store.getRoom(roomId);
    if (room && room.activeQuiz) {
      if (!room.activeQuiz.scores) room.activeQuiz.scores = {};
      room.activeQuiz.scores[socket.data.user.id] = {
        name: socket.data.user.name,
        avatar: socket.data.user.avatar || '🎓',
        score,
        totalQuestions,
        percentage: Math.round((score / totalQuestions) * 100),
        submittedAt: new Date().toISOString()
      };

      io.to(roomId).emit('quiz-leaderboard-update', {
        roomId,
        quizId,
        scores: room.activeQuiz.scores
      });
    }
  });

  socket.on('end-room-quiz', ({ roomId }) => {
    if(socket.data.roomId!==roomId)return;
    const room = store.getRoom(roomId);
    if (room) {
      const finalScores = room.activeQuiz ? room.activeQuiz.scores : {};
      room.activeQuiz = null;
      io.to(roomId).emit('room-quiz-ended', { roomId, finalScores });
    }
  });

  socket.on('disconnect', () => {
    const { roomId, user } = socket.data;
    if (roomId && user && user.id) {
      store.removeParticipant(roomId, user.id);
      const room = store.getRoom(roomId);
      if (room) {
        io.to(roomId).emit('room-participants-updated', {
          roomId,
          participants: room.participants
        });
      }
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

const buildPath = path.join(__dirname, '../build');
app.use(express.static(buildPath));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) next();
    });
  }
  next();
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🐝 StudyHive Server running on port ${PORT}`);
  console.log(`🎓 Project by: B Vikranth (24CSB0B12) & K Chandan (24CSB0B33)`);
  console.log(`🤖 Gemini AI Quiz Agent: Ready`);
  console.log(`☁️  Cloudinary File Uploads: ${cloudinaryConfigured ? 'Enabled' : 'Disabled (add credentials to .env)'}`);
  console.log(`⏱️  Synchronized Server Pomodoro: Active`);
  console.log(`====================================================`);
});
