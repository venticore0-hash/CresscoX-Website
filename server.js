const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Optional: serve your website files from the current folder
app.use(express.static(process.cwd()));

const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      lead: {
        name: '',
        email: '',
        company: '',
        service: ''
      },
      lastIntent: 'general',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  const session = sessions.get(sessionId);
  session.updatedAt = Date.now();
  return session;
}

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

function extractEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function extractName(text) {
  const value = String(text || '').trim();
  const patterns = [
    /(?:my name is|i am|i'm|this is)\s+([a-z][a-z\s'.-]{1,40})/i,
    /name\s*[:\-]\s*([a-z][a-z\s'.-]{1,40})/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return cleanEntity(match[1]);
  }

  return '';
}

function extractCompany(text) {
  const value = String(text || '').trim();
  const patterns = [
    /(?:my company is|our company is|company name is|business name is)\s+([a-z0-9][a-z0-9&,.\-\s]{1,60})/i,
    /company\s*[:\-]\s*([a-z0-9][a-z0-9&,.\-\s]{1,60})/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return cleanEntity(match[1]);
  }

  return '';
}

function cleanEntity(text) {
  return String(text || '')
    .replace(/[\n\r]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/[.,;:!?]+$/, '');
}

function detectIntent(message) {
  const text = normalize(message);

  if (!text) return 'general';
  if (/(price|pricing|cost|charges|fee|budget)/.test(text)) return 'pricing';
  if (/(crm|pipeline|hubspot|zoho|salesforce|follow[- ]?up system)/.test(text)) return 'crm';
  if (/(lead|leads|prospect|prospecting|outreach|cold email|appointment setting|booked calls?)/.test(text)) return 'lead_generation';
  if (/(virtual assistant|va\b|admin support|administrative)/.test(text)) return 'virtual_assistance';
  if (/(account management|client handling|retention|client communication)/.test(text)) return 'account_management';
  if (/(operation|operations|workflow|process|reporting|team structure|sop)/.test(text)) return 'operations';
  if (/(book|booking|appointment|call|meeting|consultation)/.test(text)) return 'appointment';
  if (/(contact|email|reach you|phone|whatsapp)/.test(text)) return 'contact';
  if (/(hello|hi|hey|salam|assalam)/.test(text)) return 'greeting';
  return 'general';
}

function updateLead(session, message, intent) {
  const email = extractEmail(message);
  const name = extractName(message);
  const company = extractCompany(message);

  if (email) session.lead.email = email;
  if (name) session.lead.name = name;
  if (company) session.lead.company = company;

  if ([
    'crm',
    'lead_generation',
    'virtual_assistance',
    'account_management',
    'operations',
    'appointment'
  ].includes(intent)) {
    session.lead.service = intent;
  }
}

function formatLeadSummary(session) {
  const parts = [];
  if (session.lead.name) parts.push(`Name: ${session.lead.name}`);
  if (session.lead.email) parts.push(`Email: ${session.lead.email}`);
  if (session.lead.company) parts.push(`Company: ${session.lead.company}`);
  if (session.lead.service) parts.push(`Main need: ${labelForIntent(session.lead.service)}`);
  return parts.join('\n');
}

function labelForIntent(intent) {
  const labels = {
    crm: 'CRM setup / cleanup',
    lead_generation: 'Lead generation / outreach',
    virtual_assistance: 'Virtual assistance',
    account_management: 'Account management',
    operations: 'Operations / workflow',
    appointment: 'Appointment / consultation',
    pricing: 'Pricing',
    contact: 'Contact',
    general: 'General inquiry'
  };
  return labels[intent] || 'General inquiry';
}

function getReply(message, session, pageContext = {}) {
  const text = normalize(message);
  const intent = detectIntent(message);
  session.lastIntent = intent;
  updateLead(session, message, intent);

  if (/^(thanks|thank you|jazakallah|ok|okay|great|perfect)\b/.test(text)) {
    return 'You’re welcome. If you want, tell me your biggest business bottleneck right now and I’ll guide you step by step.';
  }

  if (/(my email is|email is|reach me at)/.test(text) || extractEmail(message)) {
    return `Got it${session.lead.name ? `, ${session.lead.name}` : ''}. I saved your contact detail in this session.${session.lead.service ? ` Your current main need looks like ${labelForIntent(session.lead.service).toLowerCase()}.` : ''}\n\n${formatLeadSummary(session) || ''}`.trim();
  }

  if (/(summary|recap|what did i share|what info do you have)/.test(text)) {
    const summary = formatLeadSummary(session);
    return summary
      ? `Here is the information collected in this chat session:\n\n${summary}`
      : 'So far, I do not have any saved lead details in this chat session.';
  }

  const replies = {
    greeting: 'Hello. Tell me what is slowing your business down right now — lead generation, CRM, follow-up, operations, account management, or admin workload.',
    pricing: 'Pricing depends on the scope, the workload, and the type of support you need. A good next step is to tell me which service you need and roughly how big your current problem is.',
    crm: 'We can help organize your CRM by cleaning data, structuring pipelines, improving stage definitions, building follow-up discipline, and making reporting easier. Tell me which CRM you use and what feels messy right now.',
    lead_generation: 'For lead generation, the main areas are targeting, outreach messaging, follow-up consistency, and booked-call conversion. Tell me whether your biggest issue is getting replies, booking calls, or closing opportunities.',
    virtual_assistance: 'Virtual assistance support usually covers inbox handling, scheduling, admin coordination, task tracking, and day-to-day support work. Tell me which tasks are taking too much of your time.',
    account_management: 'For account management, the focus is usually smoother client communication, follow-up consistency, better handover, and retention support. Tell me where the client experience is breaking down.',
    operations: 'Operations problems usually come from unclear workflows, poor ownership, weak SOPs, and inconsistent reporting. Tell me which part of your process feels disorganized.',
    appointment: 'To prepare for an appointment, share your name, company, email, and your biggest business challenge. I can collect that here first so your conversation starts with the right context.',
    contact: 'You can share your email and company here, and I can organize the lead details inside this session. Example: “My name is Talha, my company is ABC Media, and my email is talha@example.com.”',
    general: `I can help with CRM setup, lead generation, outreach, account management, virtual assistance, and operations.${pageContext.company ? ` Since you are on ${pageContext.company},` : ''} tell me the main problem you want to solve first.`
  };

  return replies[intent] || replies.general;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'custom-chatbot-server' });
});

app.post('/api/chat', (req, res) => {
  try {
    const { sessionId, message, pageContext } = req.body || {};

    if (!sessionId || !message) {
      return res.status(400).json({
        error: 'sessionId and message are required.'
      });
    }

    const session = getSession(sessionId);
    session.history.push({ role: 'user', text: String(message), at: Date.now() });

    const reply = getReply(String(message), session, pageContext || {});
    session.history.push({ role: 'assistant', text: reply, at: Date.now() });

    res.json({
      reply,
      sessionLead: session.lead,
      lastIntent: session.lastIntent
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Unable to generate a reply right now.' });
  }
});

app.post('/api/chat/reset', (req, res) => {
  const { sessionId } = req.body || {};

  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
  }

  res.json({ ok: true });
});

app.get('*', (req, res) => {
  const indexPath = path.join(process.cwd(), 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('index.html not found in current folder.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
