// server/quizAgent.js
const FALLBACK_QUESTION_BANKS = {
  'Operating Systems': [
    {
      id: 1,
      question: "Which of the following is NOT one of Coffman's four necessary conditions for a deadlock?",
      options: [
        "Mutual Exclusion",
        "Hold and Wait",
        "Aging and Priority Inversion",
        "Circular Wait"
      ],
      answerIndex: 2,
      explanation: "Aging is a technique to prevent starvation, not one of Coffman's conditions. The four conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait."
    },
    {
      id: 2,
      question: "What happens in Round Robin CPU scheduling if the time quantum allocated is extremely large?",
      options: [
        "Context switching overhead skyrockets",
        "It behaves identically to First-Come, First-Served (FCFS)",
        "Every process starves indefinitely",
        "Throughput becomes optimal for I/O bound jobs"
      ],
      answerIndex: 1,
      explanation: "When the time slice is longer than the burst time of every ready process, each process runs to completion, effectively degrading Round Robin into FCFS."
    },
    {
      id: 3,
      question: "In virtual memory systems, what is the primary cause of 'Thrashing'?",
      options: [
        "High CPU utilization by background threads",
        "The OS spending more time swapping pages in/out than executing instructions",
        "Excessive fragmentation in contiguous heap allocation",
        "Deadlock between two competing cache lines"
      ],
      answerIndex: 1,
      explanation: "Thrashing occurs when the sum of processes' working sets exceeds total physical RAM, forcing constant page fault handling and page replacement."
    },
    {
      id: 4,
      question: "What synchronization primitive allows multiple threads to access a finite set of identical resources?",
      options: [
        "Counting Semaphore",
        "Spinlock with busy waiting",
        "Binary Mutex",
        "Condition Variable only"
      ],
      answerIndex: 0,
      explanation: "A counting semaphore maintains an integer counter initialized to the number of available resources and decrements/increments upon wait (P) and signal (V)."
    },
    {
      id: 5,
      question: "Which disk scheduling algorithm guarantees no starvation while sweeping back and forth across tracks?",
      options: [
        "FCFS",
        "SSTF (Shortest Seek Time First)",
        "SCAN (Elevator Algorithm)",
        "C-LOOK"
      ],
      answerIndex: 2,
      explanation: "The SCAN algorithm services requests in one direction until it hits the end cylinder, then reverses, preventing localized starvation seen in SSTF."
    }
  ],
  'Data Structures & Algorithms': [
    {
      id: 1,
      question: "What is the worst-case time complexity of searching in an AVL Tree with N nodes?",
      options: [
        "O(1)",
        "O(log N)",
        "O(N)",
        "O(N log N)"
      ],
      answerIndex: 1,
      explanation: "Because an AVL tree strictly enforces that the height difference between subtrees is at most 1, its height is strictly bounded by ~1.44 log2(N), guaranteeing O(log N) lookup."
    },
    {
      id: 2,
      question: "Which algorithm finds the single-source shortest path in a weighted graph with non-negative edge weights?",
      options: [
        "Dijkstra's Algorithm",
        "Bellman-Ford Algorithm",
        "Floyd-Warshall Algorithm",
        "Kruskal's Algorithm"
      ],
      answerIndex: 0,
      explanation: "Dijkstra's algorithm greedily extracts minimum distance vertices using a priority queue in O((V + E) log V) time when edge weights are strictly non-negative."
    },
    {
      id: 3,
      question: "What is the recurrence relation for the Merge Sort algorithm?",
      options: [
        "T(n) = T(n-1) + O(1)",
        "T(n) = 2T(n/2) + O(n)",
        "T(n) = T(n/2) + O(1)",
        "T(n) = 2T(n/2) + O(n^2)"
      ],
      answerIndex: 1,
      explanation: "Merge Sort divides the array into two halves of size n/2 and merges them in linear O(n) time, yielding T(n) = 2T(n/2) + O(n) which evaluates to O(n log n) by Master Theorem."
    },
    {
      id: 4,
      question: "In a min-heap with N elements stored in a 0-indexed array, where is the parent of element at index i?",
      options: [
        "floor((i - 1) / 2)",
        "2*i + 1",
        "2*i + 2",
        "floor(i / 2)"
      ],
      answerIndex: 0,
      explanation: "For a 0-indexed binary heap array, children of index i are at 2i+1 and 2i+2, while its parent is located at Math.floor((i - 1) / 2)."
    },
    {
      id: 5,
      question: "Which hash collision resolution technique stores colliding elements in a linked list at the bucket index?",
      options: [
        "Linear Probing",
        "Quadratic Probing",
        "Separate Chaining",
        "Double Hashing"
      ],
      answerIndex: 2,
      explanation: "Separate chaining maintains an auxiliary data structure (such as a linked list or red-black tree) at each table index to hold colliding elements."
    }
  ]
};

function getFallbackQuestions(topic, count = 5) {
  const normalized = (topic || '').toLowerCase();
  let baseSet = FALLBACK_QUESTION_BANKS['Operating Systems'];

  if (normalized.includes('dsa') || normalized.includes('tree') || normalized.includes('graph') || normalized.includes('algorithm')) {
    baseSet = FALLBACK_QUESTION_BANKS['Data Structures & Algorithms'];
  }

  return baseSet.slice(0, count).map((q, idx) => ({
    ...q,
    id: idx + 1
  }));
}


async function generateQuizWithGemini({
  topic,
  notesContext = '',
  difficulty = 'Medium',
  questionCount = 5,
  apiKey = null,
  model = 'gemini-3.8-flash'
}) {
  const activeKey = apiKey || process.env.GEMINI_API_KEY;

  if (!activeKey) {
    return {
      success: false,
      message: 'Topic-specific AI quizzes need a valid GEMINI_API_KEY in the server .env file. Add the key and restart the server.'
    };
  }

  const prompt = `You are "HiveBrain", the AI Study Agent for the StudyHive collaborative learning platform.
Your task is to generate a high quality, interactive, multiple-choice quiz for students in a study room. The quiz must be specifically about the exact topic below. Do not substitute Operating Systems, algorithms, or any other subject unless that is the requested topic. Make every question materially different when the requested topic changes.

Parameters:
- Topic: ${topic || 'Computer Science & Software Engineering Fundamentals'}
- Difficulty: ${difficulty}
- Number of Questions: ${questionCount}
${notesContext ? `- Attached Study Notes Context: """${notesContext.substring(0, 3000)}"""` : ''}

Requirements:
1. Provide exactly ${questionCount} multiple-choice questions.
2. Each question MUST have exactly 4 plausible options.
3. Include an "answerIndex" (0, 1, 2, or 3) pointing to the single correct option.
4. Include a concise, illuminating "explanation" explaining WHY the correct option is right and highlighting key concepts for peer learning.
5. Return ONLY a valid raw JSON array of objects. Do not include markdown code ticks, no preamble, and no trailing comments.

JSON Schema:
[
  {
    "id": 1,
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answerIndex": 0,
    "explanation": "Clear explanation here."
  }
]`;

  const availableModels = [...new Set([model || 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash'])];

  let lastError = null;

  for (const modelName of availableModels) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 2048,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const apiError = new Error(`Gemini API error (${response.status}): ${errorBody}`);
        apiError.status = response.status;
        throw apiError;
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!candidateText) {
        throw new Error('Gemini returned empty response content.');
      }

      let cleanJson = candidateText.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsedQuestions = JSON.parse(cleanJson);
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        throw new Error('Parsed response is not a valid question array.');
      }

      const validated = parsedQuestions.map((q, idx) => ({
        id: idx + 1,
        question: q.question || `Question ${idx + 1}`,
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['True', 'False', 'None of the above', 'All of the above'],
        answerIndex: typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex < (q.options?.length || 4) ? q.answerIndex : 0,
        explanation: q.explanation || 'Detailed concept explanation generated by StudyHive AI.'
      }));

      return {
        success: true,
        source: `gemini (${modelName})`,
        topic: topic || 'Custom Topic',
        difficulty,
        questions: validated
      };
    } catch (err) {
      console.warn(`[QuizAgent] Attempt with model ${modelName} failed:`, err.message);
      lastError = err;
      if (err.status === 503 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      break;
      }
    }
  }

  console.error('[QuizAgent] Quiz generation failed.', lastError);
  const providerDetail = String(lastError?.message || '').replace(/\s+/g, ' ').slice(0, 280);
  return {
    success: false,
    message: `Could not generate a topic-specific quiz for “${topic}”. ${providerDetail || 'Check the Gemini API key, model access, and quota, then try again.'}`
  };
}

module.exports = {
  generateQuizWithGemini,
  getFallbackQuestions
};
