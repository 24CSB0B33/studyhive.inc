const crypto = require('crypto');

class StudyHiveStore {
  constructor() {
    this.users = [
      {
        id: 'user-1',
        name: 'Aarav Mehta',
        role: 'Focus Scholar',
        avatar: '👨‍💻',
        email: 'aarav@gmail.com'
      },
      {
        id: 'user-2',
        name: 'Ananya Iyer',
        role: 'CS Researcher',
        avatar: '🚀',
        email: 'ananya@gmail.com'
      },
      {
        id: 'user-3',
        name: 'Kabir Rao',
        role: 'Peer Scholar',
        avatar: '📚',
        email: 'kabir@gmail.com'
      }
    ];

    this.rooms = {
      'room-os': {
        id: 'room-os', visibility: 'public',
        title: 'Operating Systems & Concurrency Hive',
        description: 'Deep dive into CPU scheduling, virtual memory, synchronization primitives, and deadlocks.',
        topic: 'Operating Systems',
        category: 'Computer Science',
        hostId: 'user-1',
        hostName: 'Aarav Mehta',
        participants: [
          { id: 'user-1', name: 'Aarav Mehta', avatar: '👨‍💻', role: 'Host', status: 'Focusing' },
          { id: 'user-2', name: 'Ananya Iyer', avatar: '🚀', role: 'Scholar', status: 'Focusing' }
        ],
        pomodoro: {
          mode: 'work',
          timeLeft: 25 * 60,
          workDuration: 25 * 60,
          breakDuration: 5 * 60,
          isRunning: false,
          cyclesCompleted: 2
        },
        activeQuiz: null,
        createdAt: new Date().toISOString()
      },
      'room-dsa': {
        id: 'room-dsa', visibility: 'public',
        title: 'DSA Sprint: Trees, Heaps & DP',
        description: 'Practicing tree traversals, shortest path algorithms, and dynamic programming patterns.',
        topic: 'Data Structures',
        category: 'Algorithms',
        hostId: 'user-2',
        hostName: 'Ananya Iyer',
        participants: [
          { id: 'user-2', name: 'Ananya Iyer', avatar: '🚀', role: 'Host', status: 'Focusing' }
        ],
        pomodoro: {
          mode: 'work',
          timeLeft: 25 * 60,
          workDuration: 25 * 60,
          breakDuration: 5 * 60,
          isRunning: false,
          cyclesCompleted: 1
        },
        activeQuiz: null,
        createdAt: new Date().toISOString()
      },
      'room-systems': {
        id: 'room-systems', visibility: 'public',
        title: 'Distributed Systems & WebSockets',
        description: 'Analyzing state synchronization, Socket.io event models, and low-latency client-server architectures.',
        topic: 'System Design',
        category: 'Architecture',
        hostId: 'user-1',
        hostName: 'Aarav Mehta',
        participants: [],
        pomodoro: {
          mode: 'work',
          timeLeft: 25 * 60,
          workDuration: 25 * 60,
          breakDuration: 5 * 60,
          isRunning: false,
          cyclesCompleted: 0
        },
        activeQuiz: null,
        createdAt: new Date().toISOString()
      }
    };

    this.messages = {
      'room-os': [
        {
          id: 'msg-1',
          roomId: 'room-os',
          senderId: 'user-1',
          senderName: 'Aarav Mehta',
          senderAvatar: '👨‍💻',
          role: 'Host',
          content: 'Starting our 25-minute focus session on CPU scheduling algorithms. We will run a Gemini AI quiz at the break!',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
          id: 'msg-2',
          roomId: 'room-os',
          senderId: 'user-2',
          senderName: 'Ananya Iyer',
          senderAvatar: '🚀',
          role: 'Scholar',
          content: 'I uploaded my notes on Coffman deadlock conditions into the Shared Notes tab. Ready to focus.',
          timestamp: new Date(Date.now() - 1000 * 60 * 10).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      'room-dsa': [
        {
          id: 'msg-3',
          roomId: 'room-dsa',
          senderId: 'user-2',
          senderName: 'Ananya Iyer',
          senderAvatar: '🚀',
          role: 'Host',
          content: 'Working on AVL rotation cases and balance factor formulas.',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      'room-systems': []
    };

    this.resources = [
      {
        id: 'res-1',
        roomId: 'room-os',
        title: 'CPU Scheduling & Context Switching Summary',
        description: 'Comparative breakdown of FCFS, Shortest Job First, SRTF, and Round Robin quantum heuristics.',
        content: `### CPU Scheduling Algorithms\n\n1. **Preemptive vs Non-Preemptive**:\n   - Non-preemptive: Once CPU allocated, process keeps it until termination or I/O wait.\n   - Preemptive: OS can interrupt running process (e.g., Round Robin, SRTF).\n\n2. **Round Robin (RR)**:\n   - Circular FIFO ready queue.\n   - Time quantum $q$ typically 10-100ms.`,
        tags: ['OS', 'Concurrency', 'Scheduling'],
        category: 'Operating Systems',
        uploaderId: 'user-1',
        uploaderName: 'Aarav Mehta',
        upvotes: ['user-2', 'user-3'],
        downvotes: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString()
      },
      {
        id: 'res-2',
        roomId: 'room-os',
        title: 'Coffman Conditions & Deadlock Avoidance',
        description: 'The four necessary conditions for deadlocks and Bankers Algorithm safe state calculations.',
        content: `### 4 Coffman Conditions for Deadlock\n1. **Mutual Exclusion**: At least one unshareable resource.\n2. **Hold and Wait**: Process holding resources requests others.\n3. **No Preemption**: Resources cannot be forcibly revoked.\n4. **Circular Wait**: Closed chain of processes where each holds a resource needed by the next.`,
        tags: ['OS', 'Deadlocks', 'Semaphores'],
        category: 'Operating Systems',
        uploaderId: 'user-2',
        uploaderName: 'Ananya Iyer',
        upvotes: ['user-1', 'user-3'],
        downvotes: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString()
      },
      {
        id: 'res-3',
        roomId: 'room-dsa',
        title: 'Self-Balancing Trees: AVL vs Red-Black Trees',
        description: 'Rotations guide (LL, RR, LR, RL) with height bounds and asymptotic comparisons.',
        content: `### AVL Trees vs Red-Black Trees\n- **AVL Tree**: Stricter balance factor. Faster lookups, slightly more rotations on insertion/deletion.\n- **Red-Black Tree**: Relaxed balance. Faster insertions and deletions, used in standard library map structures.`,
        tags: ['DSA', 'Trees', 'Algorithms'],
        category: 'Data Structures',
        uploaderId: 'user-2',
        uploaderName: 'Ananya Iyer',
        upvotes: ['user-1'],
        downvotes: [],
        createdAt: new Date(Date.now() - 1000 * 60 * 40).toISOString()
      }
    ];
  }

  getRooms() {
    return Object.values(this.rooms);
  }

  getRoom(roomId) {
    return this.rooms[roomId] || null;
  }

  createRoom({ title, description, topic, category, hostId, hostName, visibility }) {
    const id = 'room-' + crypto.randomUUID();
    const inviteToken = visibility === 'private' ? crypto.randomBytes(32).toString('base64url') : null;
    const newRoom = {
      id,
      visibility: visibility === 'private' ? 'private' : 'public',
      inviteToken,
      title,
      description: description || 'Collaborative study space',
      topic: topic || 'General Study',
      category: category || 'General',
      hostId: hostId || 'user-1',
      hostName: hostName || 'Aarav Mehta',
      participants: [
        { id: hostId || 'user-1', name: hostName || 'Aarav Mehta', avatar: '👨‍💻', role: 'Host', status: 'Focusing' }
      ],
      pomodoro: {
        mode: 'work',
        timeLeft: 25 * 60,
        workDuration: 25 * 60,
        breakDuration: 5 * 60,
        isRunning: false,
        cyclesCompleted: 0
      },
      activeQuiz: null,
      createdAt: new Date().toISOString()
    };
    this.rooms[id] = newRoom;
    this.messages[id] = [];
    return newRoom;
  }

  deleteRoom(roomId) {
    if (!this.rooms[roomId]) return false;
    delete this.rooms[roomId]; delete this.messages[roomId];
    this.resources = this.resources.filter((r) => r.roomId !== roomId);
    return true;
  }

  addParticipant(roomId, user) {
    const room = this.rooms[roomId];
    if (!room) return null;
    const existing = room.participants.find(p => p.id === user.id);
    if (!existing) {
      room.participants.push({
        id: user.id,
        name: user.name,
        avatar: user.avatar || '🎓',
        role: user.id === room.hostId ? 'Host' : 'Scholar',
        status: 'Focusing'
      });
    }
    return room;
  }

  removeParticipant(roomId, userId) {
    const room = this.rooms[roomId];
    if (!room) return null;
    room.participants = room.participants.filter(p => p.id !== userId);
    return room;
  }

  getMessages(roomId) {
    return this.messages[roomId] || [];
  }

  addMessage(roomId, message) {
    if (!this.messages[roomId]) {
      this.messages[roomId] = [];
    }
    const newMsg = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      roomId,
      senderId: message.senderId,
      senderName: message.senderName,
      senderAvatar: message.senderAvatar || '👨‍💻',
      role: message.role || 'Scholar',
      content: message.content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.messages[roomId].push(newMsg);
    return newMsg;
  }

  getResources(roomId, tag, search) {
    let list = this.resources.filter((resource) => resource.roomId === roomId);
    if (tag) {
      list = list.filter(r => r.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      const scoreA = (a.upvotes?.length || 0) - (a.downvotes?.length || 0);
      const scoreB = (b.upvotes?.length || 0) - (b.downvotes?.length || 0);
      return scoreB - scoreA;
    });
    return list;
  }

  addResource(resource) {
    const newRes = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      roomId: resource.roomId,
      title: resource.title,
      description: resource.description || '',
      content: resource.content || '',
      tags: resource.tags || ['General'],
      category: resource.category || 'General',
      uploaderId: resource.uploaderId || 'user-1',
      uploaderName: resource.uploaderName || 'Scholar',
      upvotes: [],
      downvotes: [],
      fileUrl: resource.fileUrl || null,
      fileName: resource.fileName || null,
      fileType: resource.fileType || null,
      fileSize: resource.fileSize || null,
      createdAt: new Date().toISOString()
    };
    this.resources.unshift(newRes);
    return newRes;
  }

  voteResource(roomId, resourceId, userId, voteType) {
    const res = this.resources.find((resource) => resource.id === resourceId && resource.roomId === roomId);
    if (!res) return null;

    if (!res.upvotes) res.upvotes = [];
    if (!res.downvotes) res.downvotes = [];

    if (voteType === 'up') {
      const upIdx = res.upvotes.indexOf(userId);
      if (upIdx !== -1) {
        res.upvotes.splice(upIdx, 1);
      } else {
        res.upvotes.push(userId);
        const downIdx = res.downvotes.indexOf(userId);
        if (downIdx !== -1) res.downvotes.splice(downIdx, 1);
      }
    } else if (voteType === 'down') {
      const downIdx = res.downvotes.indexOf(userId);
      if (downIdx !== -1) {
        res.downvotes.splice(downIdx, 1);
      } else {
        res.downvotes.push(userId);
        const upIdx = res.upvotes.indexOf(userId);
        if (upIdx !== -1) res.upvotes.splice(upIdx, 1);
      }
    }

    return res;
  }

  toggleUpvote(roomId, resourceId, userId) {
    return this.voteResource(roomId, resourceId, userId, 'up');
  }
}

module.exports = new StudyHiveStore();
