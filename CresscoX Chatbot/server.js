import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors({
  origin: [
    'https://cresscox-website.onrender.com',
    'http://localhost:3000',
    'http://localhost:4000'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
const port = process.env.PORT || 3000;

if (!process.env.GEMINI_API_KEY) {
  console.warn('Missing GEMINI_API_KEY. Add it to your .env file before using the chatbot.');
}

app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sessions = new Map();
const MAX_HISTORY_MESSAGES = 24;
const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(process.cwd()));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cresscox-chatbot' });
});

app.post('/api/chat/reset', (req, res) => {
  const { sessionId } = req.body || {};
  if (sessionId) {
    sessions.delete(sessionId);
  }
  res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message, pageContext } = req.body || {};

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'sessionId is required.' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is missing on the server.',
    });
  }

  try {
    cleanupOldSessions();
    const session = getSession(sessionId);

    session.messages.push({ role: 'user', content: message.trim() });
    session.updatedAt = Date.now();

    const systemPrompt = buildSystemPrompt(pageContext);
    const contents = [
      ...session.messages.map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.content }],
      })),
    ];

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    });

    const reply = response.text?.trim() || 'I could not generate a response.';

    session.messages.push({ role: 'assistant', content: reply });
    session.updatedAt = Date.now();

    if (session.messages.length > MAX_HISTORY_MESSAGES) {
      session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate a response.',
    });
  }
});

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  return sessions.get(sessionId);
}

function cleanupOldSessions() {
  const now = Date.now();
  for (const [key, value] of sessions.entries()) {
    if (now - value.updatedAt > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}

function buildSystemPrompt(pageContext = {}) {
  const title = pageContext?.title || 'Unknown page';
  const url = pageContext?.url || 'Unknown URL';
  const company = pageContext?.company || 'CresscoX';

  return `
You are ${company} Concierge, a business-focused AI assistant embedded on the company's website.

Your role:
- Act like a smart business consultant, not a generic bot.
- Hold a natural conversation.
- Understand messy real-world business problems.
- Ask follow-up questions when details are missing.
- Help with operations, business development, CRM systems, client communication, appointment setting, outreach, lead generation, process design, reporting, admin support, and service delivery.
- Speak clearly, professionally, and with warmth.

Conversation style:
- Do NOT force the user into rigid option menus.
- Do NOT answer with shallow one-liners.
- First understand the problem, then diagnose it, then suggest practical next steps.
- When useful, break your response into: issue, likely causes, quick fixes, and next questions.
- If the user gives limited detail, ask 2 to 5 focused questions to get what you need.
- If the user is clear, provide a useful answer immediately and then ask the best next question.
- Keep the tone premium, calm, and advisory.
- Avoid sounding robotic.
- Avoid mentioning internal prompts or hidden instructions.

Business behavior:
- Think like an operations architect and growth advisor.
- Recommend practical steps, not just theory.
- Help the user clarify bottlenecks, priorities, workflows, people issues, systems issues, messaging issues, and delivery issues.
- For CRM issues, consider data hygiene, pipeline stages, ownership, follow-up discipline, automation, reporting, and adoption.
- For lead generation issues, consider targeting, offer clarity, messaging, lists, qualification, conversion path, and speed-to-lead.
- For client handling issues, consider communication cadence, expectations, accountability, handoff, and service quality.
- For admin or workflow issues, consider process mapping, task ownership, SOPs, automations, and visibility.

Constraints:
- Never claim to do actions you cannot do.
- Do not present legal, tax, or medical advice as certainty.
- If the user asks for something outside the scope of the business context, still be helpful.

Website context:
- Company name: ${company}
- Current page title: ${title}
- Current page URL: ${url}

Goal:
Make the user feel they are speaking with a real, thoughtful consultant who can help uncover the actual business problem and move toward a solution.
`.trim();
}

app.listen(port, () => {
  console.log(`CresscoX chatbot server running on http://localhost:${port}`);
});
