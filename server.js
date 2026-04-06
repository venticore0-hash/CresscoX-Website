
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(process.cwd()));

const sessions = new Map();

const BOT_CONFIG = {
  assistantName: 'CresscoX Concierge',
  companyName: 'CresscoX',
  maxHistory: 40,
  bookingLink: '/#appointment',
  contactLink: '/#contact'
};

const CRM_NAMES = {
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  zoho: 'Zoho',
  pipedrive: 'Pipedrive',
  freshsales: 'Freshsales',
  highlevel: 'HighLevel',
  gohighlevel: 'HighLevel',
  close: 'Close',
  monday: 'Monday CRM',
  agilecrm: 'Agile CRM',
  copper: 'Copper',
  apollo: 'Apollo',
  excel: 'Excel / Spreadsheet'
};

const SERVICE_CATALOG = {
  crm_systems: {
    label: 'CRM systems',
    subservices: [
      'CRM setup from scratch',
      'pipeline and deal stage design',
      'data cleanup and deduplication',
      'automation and workflow setup',
      'reporting dashboards',
      'migration from spreadsheets or old CRMs',
      'team adoption and usage discipline',
      'handover and follow-up process design'
    ],
    qualifying: [
      'What is the main issue right now: setup, messy data, automation, reporting, migration, or team usage?',
      'Which CRM are you using now?',
      'How many users or reps need to work inside it?',
      'Do you need a cleanup, redesign, or full rebuild?'
    ]
  },
  business_development: {
    label: 'Lead generation',
    subservices: [
      'ICP and targeting',
      'lead list building',
      'cold email campaigns',
      'LinkedIn outreach',
      'follow-up sequencing',
      'reply handling',
      'meeting booking',
      'sales process improvement'
    ],
    qualifying: [
      'Are you struggling more with finding leads, getting replies, or converting replies into meetings?',
      'Who is your target market?',
      'What outbound channels are you using today?',
      'What outcome do you want in the next 30 to 90 days?'
    ]
  },
  account_management: {
    label: 'Account management',
    subservices: [
      'client handover structure',
      'follow-up cadence',
      'retention support',
      'renewal coordination',
      'client communication process',
      'ownership and accountability mapping',
      'customer success workflow'
    ],
    qualifying: [
      'Is the bigger issue handover, follow-up consistency, retention, or communication quality?',
      'How many active accounts are involved?',
      'Does the breakdown happen between sales and account managers, or later in delivery?'
    ]
  },
  operations: {
    label: 'Operations support',
    subservices: [
      'SOP creation',
      'workflow design',
      'task accountability',
      'reporting visibility',
      'approval flows',
      'cross-team coordination',
      'handover checkpoints'
    ],
    qualifying: [
      'Which part feels messy right now: workflow, ownership, approvals, reporting, or handover?',
      'Where do delays happen most often?',
      'Do you need SOPs, reporting, or workflow redesign first?'
    ]
  },
  virtual_assistance: {
    label: 'Virtual assistance',
    subservices: [
      'inbox management',
      'calendar management',
      'research and data entry',
      'CRM updates',
      'follow-up support',
      'documentation',
      'coordination and admin'
    ],
    qualifying: [
      'Do you need full-time dedicated support or part-time support for specific tasks?',
      'Which tasks are taking the most time each week?',
      'Do you need timezone overlap with your team or clients?'
    ]
  }
};

const FAQ_LIBRARY = [
  {
    key: 'migration_excel_to_crm',
    tests: [/migrate.*excel/i, /excel.*crm/i, /spreadsheet.*crm/i, /move.*excel.*crm/i],
    answer:
      'Yes — CresscoX can help move data from Excel or spreadsheets into a proper CRM. That usually includes cleanup, field mapping, deduplication, pipeline setup, and workflow structure. If you want, tell me which CRM you want to move into and roughly how many contacts or companies are involved.'
  },
  {
    key: 'reply_rate',
    tests: [/reply rate/i, /typical reply/i, /outbound.*reply/i],
    answer:
      'Reply rates vary a lot based on targeting, offer quality, list quality, market, and messaging. A stronger answer comes from your niche and channel mix, but in practice the real focus should be qualified replies and booked meetings, not reply rate alone. If you tell me your market and outbound channel, I can frame a more realistic benchmark.'
  },
  {
    key: 'handover_sales_to_am',
    tests: [/handover.*sales.*account/i, /sales team.*account managers/i, /between the sales team and the account managers/i],
    answer:
      'The handover should be structured, not informal. A strong setup usually includes required CRM fields, deal notes, next-step ownership, client goals, scope summary, and a clear internal handover checkpoint. That reduces dropped context and improves client experience.'
  },
  {
    key: 'sops',
    tests: [/\bsop\b/i, /\bstandard operating procedures\b/i],
    answer:
      'Yes — SOP support fits naturally inside operations work. That can include documenting repeatable workflows, responsibilities, approval steps, handovers, and tracking points so execution becomes easier to manage.'
  },
  {
    key: 'va_timezone',
    tests: [/virtual assistant.*time zone/i, /va.*time zone/i, /work in my time zone/i],
    answer:
      'That depends on the support model you need. If the role is client-facing, calendar-heavy, or follow-up-sensitive, timezone overlap matters more. If it is task-based back-office support, a part-overlap schedule can still work very well.'
  }
];

const INTENT_MODELS = {
  greeting: {
    examples: ['hello', 'hi there', 'hey', 'good morning'],
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'salam', 'assalam']
  },
  smalltalk: {
    examples: ['how are you', 'how are you doing', 'how is it going'],
    patterns: ['how are you', 'how are you doing', 'how is it going', 'how are things']
  },
  thanks: {
    examples: ['thanks', 'thank you', 'perfect'],
    patterns: ['thanks', 'thank you', 'jazakallah', 'perfect', 'great']
  },
  demo_request: {
    examples: ['i want a demo', 'show me a demo of hubspot setup', 'can i see how your lead generation workflow works'],
    patterns: ['demo', 'show me', 'walk me through', 'see how it works']
  },
  audit_request: {
    examples: ['audit my current setup', 'review my crm', 'audit my outbound process'],
    patterns: ['audit my current setup', 'audit my crm', 'review my setup', 'review my crm', 'audit']
  },
  pricing_request: {
    examples: ['pricing for a custom project', 'how much would a custom setup cost', 'custom quote'],
    patterns: ['pricing', 'price', 'quote', 'quotation', 'budget', 'cost', 'custom project']
  },
  emergency_request: {
    examples: ['emergency help system down', 'our hubspot automation is broken', 'we are locked out of salesforce'],
    patterns: ['emergency', 'urgent', 'system down', 'broken right now', 'locked out', 'not working', 'asap']
  },
  hire_va_request: {
    examples: ['hire a va', 'need a virtual assistant', 'looking for admin support'],
    patterns: ['hire a va', 'virtual assistant', 'need an assistant', 'admin support']
  },
  booking_request: {
    examples: ['book a call', 'schedule a meeting', 'i want a consultation'],
    patterns: ['book a call', 'schedule a call', 'book appointment', 'schedule meeting', 'consultation', 'strategy call']
  },
  crm_help: {
    examples: ['i need help with hubspot', 'crm is messy', 'salesforce automation is broken', 'need crm setup'],
    patterns: ['crm', 'hubspot', 'salesforce', 'zoho', 'pipedrive', 'pipeline', 'automation', 'data cleanup', 'crm setup', 'crm migration']
  },
  lead_generation: {
    examples: ['need more leads', 'our cold email is not getting replies', 'lead generation help'],
    patterns: ['lead generation', 'need more leads', 'cold email', 'outreach', 'prospecting', 'reply rate', 'booked calls']
  },
  account_management: {
    examples: ['client handover is messy', 'account management support', 'clients are dropping'],
    patterns: ['account management', 'client handover', 'retention', 'customer success', 'client communication', 'renewal']
  },
  operations: {
    examples: ['we need sops', 'operations are messy', 'workflow is broken', 'need better reporting'],
    patterns: ['operations', 'workflow', 'process', 'sop', 'reporting', 'handover', 'coordination', 'approvals']
  },
  contact: {
    examples: ['how can i contact you', 'whatsapp number', 'email your team'],
    patterns: ['contact', 'reach you', 'whatsapp', 'email you', 'phone number', 'get in touch']
  },
  general: {
    examples: ['need business support', 'can you help my company', 'need help'],
    patterns: []
  }
};

const SYNONYM_GROUPS = [
  ['crm', 'pipeline', 'deal stages', 'deal stage', 'records', 'contacts', 'companies'],
  ['lead generation', 'lead gen', 'prospecting', 'outreach', 'cold email', 'cold calling', 'appointment setting'],
  ['virtual assistant', 'va', 'admin support', 'assistant', 'calendar', 'inbox'],
  ['operations', 'workflow', 'process', 'sop', 'handover', 'coordination', 'reporting'],
  ['audit', 'review', 'assess', 'diagnose'],
  ['demo', 'show', 'walkthrough', 'walk through'],
  ['book', 'schedule', 'arrange', 'meeting', 'call', 'consultation'],
  ['urgent', 'emergency', 'asap', 'critical'],
  ['pricing', 'price', 'cost', 'quote', 'budget'],
  ['messy', 'broken', 'chaotic', 'disorganized', 'unclear'],
  ['migrate', 'migration', 'move', 'transfer', 'import']
];

function createEmptySession(sessionId) {
  return {
    sessionId,
    history: [],
    stage: 'discovery',
    lastIntent: 'general',
    confidence: 0,
    pendingQuestion: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lead: {
      name: '',
      email: '',
      company: '',
      service: '',
      crmName: '',
      issueType: '',
      urgency: '',
      goal: '',
      teamSize: '',
      volume: '',
      preferredBookingType: '',
      faqTopic: ''
    }
  };
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createEmptySession(sessionId));
  }
  const session = sessions.get(sessionId);
  session.updatedAt = Date.now();
  return session;
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9@.\s&+\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(' ')
    .filter(Boolean)
    .map(stemToken);
}

function stemToken(token) {
  return token
    .replace(/(ing|ers|er|ed|ly|ment|tion|s)$/i, '')
    .trim();
}

function makeNGrams(value, size = 3) {
  const text = ` ${normalize(value)} `;
  const grams = new Set();
  for (let i = 0; i < text.length - size + 1; i += 1) {
    grams.add(text.slice(i, i + size));
  }
  return grams;
}

function diceCoefficient(a, b) {
  const ag = makeNGrams(a);
  const bg = makeNGrams(b);
  if (!ag.size || !bg.size) return 0;
  let overlap = 0;
  ag.forEach((gram) => {
    if (bg.has(gram)) overlap += 1;
  });
  return (2 * overlap) / (ag.size + bg.size);
}

function overlapScore(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let overlap = 0;
  a.forEach((token) => {
    if (b.has(token)) overlap += 1;
  });
  return overlap / Math.max(a.size, b.size);
}

function expandText(text) {
  let expanded = ` ${normalize(text)} `;
  SYNONYM_GROUPS.forEach((group) => {
    const hit = group.some((item) => expanded.includes(` ${normalize(item)} `));
    if (hit) expanded += ` ${group.map(normalize).join(' ')} `;
  });
  return expanded.trim();
}

function matchPatterns(text, patterns) {
  const normalized = normalize(text);
  let score = 0;
  patterns.forEach((pattern) => {
    const p = normalize(pattern);
    if (!p) return;
    if (normalized.includes(p)) score = Math.max(score, 1);
    score = Math.max(score, diceCoefficient(normalized, p) * 0.85);
  });
  return score;
}

function detectDirectIntent(text) {
  const normalized = normalize(text);
  const directChecks = [
    ['smalltalk', ['how are you', 'how are you doing', 'how is it going', 'how are things']],
    ['greeting', ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'salam', 'assalam']],
    ['demo_request', ['demo request', 'i want a demo', 'need a demo', 'show me a demo', 'can i see a demo', 'book a demo', 'demo']],
    ['audit_request', ['audit my current setup', 'audit my crm', 'review my crm', 'review my setup', 'audit request', 'audit']],
    ['pricing_request', ['pricing for a custom project', 'custom pricing', 'custom quote', 'quote', 'pricing', 'price']],
    ['emergency_request', ['emergency help', 'system down', 'urgent help', 'locked out', 'asap', 'critical issue']],
    ['hire_va_request', ['hire a va', 'need a va', 'need a virtual assistant', 'virtual assistant', 'admin support']],
    ['booking_request', ['book a call', 'book a meeting', 'schedule a call', 'schedule a meeting', 'strategy call', 'consultation']],
    ['contact', ['how can i contact you', 'contact you', 'get in touch', 'whatsapp', 'phone number']]
  ];

  for (const [intent, patterns] of directChecks) {
    for (const phrase of patterns) {
      const p = normalize(phrase);
      if (normalized === p || normalized.startsWith(`${p} `) || normalized.includes(` ${p} `) || normalized.endsWith(` ${p}`)) {
        return { intent, confidence: 0.98 };
      }
    }
  }

  if (normalized.length <= 12 && ['hi', 'hey', 'hello'].includes(normalized)) {
    return { intent: 'greeting', confidence: 0.99 };
  }

  return null;
}

function classifyIntent(text) {
  const directIntent = detectDirectIntent(text);
  if (directIntent) return directIntent;

  const expanded = expandText(text);
  const expandedTokens = tokenize(expanded);

  let bestIntent = 'general';
  let bestScore = 0;

  Object.entries(INTENT_MODELS).forEach(([intent, model]) => {
    let score = 0;

    (model.examples || []).forEach((example) => {
      const exExpanded = expandText(example);
      const exampleScore =
        overlapScore(expandedTokens, tokenize(exExpanded)) * 0.55 +
        diceCoefficient(expanded, exExpanded) * 0.45;
      score = Math.max(score, exampleScore);
    });

    const patternScore = matchPatterns(expanded, model.patterns || []);
    score = Math.max(score, patternScore);

    if (score > bestScore) {
      bestIntent = intent;
      bestScore = score;
    }
  });

  if (bestScore < 0.22) {
    if (hasAny(expanded, ['hubspot', 'salesforce', 'zoho', 'pipedrive', 'highlevel', 'crm'])) return { intent: 'crm_help', confidence: 0.42 };
    if (hasAny(expanded, ['lead', 'outreach', 'cold email', 'reply', 'meeting', 'prospecting'])) return { intent: 'lead_generation', confidence: 0.4 };
    if (hasAny(expanded, ['virtual assistant', 'admin support', 'calendar', 'inbox'])) return { intent: 'hire_va_request', confidence: 0.4 };
    if (hasAny(expanded, ['operations', 'workflow', 'sop', 'process'])) return { intent: 'operations', confidence: 0.4 };
    return { intent: 'general', confidence: 0.2 };
  }

  return { intent: bestIntent, confidence: Number(bestScore.toFixed(3)) };
}

function hasAny(text, list) {
  const normalized = normalize(text);
  return list.some((item) => normalized.includes(normalize(item)));
}

function detectCrmName(text) {
  const normalized = normalize(text);
  for (const [key, label] of Object.entries(CRM_NAMES)) {
    if (normalized.includes(key)) return label;
  }
  return '';
}

function detectService(text) {
  const normalized = normalize(text);
  if (hasAny(normalized, ['crm', 'hubspot', 'salesforce', 'zoho', 'pipeline', 'automation'])) return 'crm_systems';
  if (hasAny(normalized, ['lead generation', 'lead gen', 'outreach', 'cold email', 'prospecting', 'booked calls'])) return 'business_development';
  if (hasAny(normalized, ['account management', 'customer success', 'retention', 'handover', 'renewal'])) return 'account_management';
  if (hasAny(normalized, ['operations', 'workflow', 'sop', 'process', 'reporting'])) return 'operations';
  if (hasAny(normalized, ['virtual assistant', 'admin support', 'calendar', 'inbox', 'assistant'])) return 'virtual_assistance';
  return '';
}

function detectIssueType(text) {
  const normalized = normalize(text);
  const issueMap = [
    ['setup', ['setup', 'from scratch', 'configure', 'configured']],
    ['messy data', ['messy', 'dirty data', 'duplicate', 'dedupe', 'cleanup', 'cleanup']],
    ['automation', ['automation', 'workflow', 'sequence', 'trigger']],
    ['reporting', ['reporting', 'dashboard', 'visibility', 'track']],
    ['migration', ['migrate', 'migration', 'import', 'move from excel', 'transfer']],
    ['team usage', ['team usage', 'team adoption', 'nobody updates', 'not using it']],
    ['reply rate', ['reply rate', 'no replies', 'poor replies']],
    ['booked meetings', ['booked calls', 'booked meetings', 'appointments']],
    ['handover', ['handover', 'handoff']],
    ['sops', ['sop', 'standard operating procedure']],
    ['technical lockout', ['locked out', 'login issue', 'cannot access', 'cant access']],
    ['broken workflow', ['system down', 'broken', 'not working', 'stopped working']]
  ];

  for (const [label, patterns] of issueMap) {
    if (hasAny(normalized, patterns)) return label;
  }
  return '';
}

function detectFaqTopic(text) {
  for (const faq of FAQ_LIBRARY) {
    if (faq.tests.some((test) => test.test(text))) return faq.key;
  }
  return '';
}

function extractName(text) {
  const raw = String(text || '');
  const match = raw.match(/(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z\s'.-]{1,40})/i);
  return match ? cleanValue(match[1]) : '';
}

function extractEmail(text) {
  const match = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : '';
}

function extractCompany(text) {
  const raw = String(text || '');
  const match = raw.match(/(?:company is|we are|our company is|business is)\s+([A-Za-z0-9][A-Za-z0-9\s&.,'-]{1,60})/i);
  return match ? cleanValue(match[1]) : '';
}

function extractVolume(text) {
  const raw = normalize(text);
  const match = raw.match(/(\d[\d,]*)\s*(leads|contacts|accounts|companies|reps|users)/i);
  return match ? `${match[1]} ${match[2]}` : '';
}

function cleanValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().replace(/[.,;:!?]+$/, '');
}

function applyEntities(session, message) {
  const crmName = detectCrmName(message);
  const service = detectService(message);
  const issueType = detectIssueType(message);
  const faqTopic = detectFaqTopic(message);

  if (crmName) session.lead.crmName = crmName;
  if (service) session.lead.service = service;
  if (issueType) session.lead.issueType = issueType;
  if (faqTopic) session.lead.faqTopic = faqTopic;

  const email = extractEmail(message);
  const name = extractName(message);
  const company = extractCompany(message);
  const volume = extractVolume(message);

  if (email) session.lead.email = email;
  if (name) session.lead.name = name;
  if (company) session.lead.company = company;
  if (volume) session.lead.volume = volume;

  if (hasAny(message, ['urgent', 'asap', 'immediately', 'right now', 'today'])) {
    session.lead.urgency = 'high';
  }

  if (hasAny(message, ['demo'])) session.lead.preferredBookingType = 'demo';
  if (hasAny(message, ['audit'])) session.lead.preferredBookingType = 'audit';
  if (hasAny(message, ['book', 'schedule', 'call', 'meeting', 'consultation'])) {
    session.lead.preferredBookingType = session.lead.preferredBookingType || 'strategy call';
  }
}

function qualificationScore(session) {
  const lead = session.lead || {};
  let score = 0;
  ['service', 'crmName', 'issueType', 'company', 'email', 'volume'].forEach((field) => {
    if (lead[field]) score += 1;
  });
  return score;
}

function updateStage(session) {
  const score = qualificationScore(session);
  if (score >= 5) session.stage = 'ready_to_book';
  else if (score >= 3) session.stage = 'qualified';
  else session.stage = 'discovery';
}

function findFaqAnswer(key) {
  return FAQ_LIBRARY.find((item) => item.key === key);
}

function bookingCTA(session) {
  const base = `If you want, the next step is to book through ${BOT_CONFIG.bookingLink}.`;
  if (session.stage === 'ready_to_book') {
    return `${base} You already shared enough for a productive call.`;
  }
  return `${base} Before that, I can help tighten the scope in one or two quick questions.`;
}

function getPrimaryContext(source) {
  const lead = source.lead || source;
  if (lead.crmName) return lead.crmName;
  if (lead.service) return SERVICE_CATALOG[lead.service]?.label || lead.service;
  return '';
}

function buildGreetingReply(session) {
  const nameLine = session.lead.name ? `Hello ${session.lead.name} — ` : 'Hello — ';
  return `${nameLine}how can CresscoX help today?`;
}

function buildSmalltalkReply() {
  const context = getPrimaryContext(session);
  if (context) return `I’m doing well, thanks. Is this about **${context}**, or something else?`;
  return 'I’m doing well, thanks. What do you need help with today?';
}

function buildThanksReply() {
  return 'You’re welcome. What would you like help with next?';
}

function buildDemoReply(session) {
  const crmName = session.lead.crmName;
  const service = session.lead.service;
  if (crmName) {
    return `Absolutely. We can focus the demo around **${crmName}**. Would you like to see a demo of a specific **CRM setup**, **automation flow**, or **reporting workflow**? ${bookingCTA(session)}`;
  }
  if (service === 'business_development') {
    return `Absolutely. We can focus the demo on the **lead generation workflow**. Do you want to see **targeting**, **outreach flow**, **follow-up logic**, or **reply handling**? ${bookingCTA(session)}`;
  }
  return `Absolutely. Do you want a demo of a **CRM setup**, **lead generation workflow**, or **operations flow**? ${bookingCTA(session)}`;
}

function buildAuditReply(session) {
  const crmName = session.lead.crmName;
  if (crmName) {
    return `We can definitely audit your **${crmName}** setup. Are we auditing the **CRM database and pipeline structure**, or the **way your team uses it day to day**? ${bookingCTA(session)}`;
  }
  return `We can definitely audit the setup. Are we auditing an **existing CRM database**, or your **current outbound sales process**? ${bookingCTA(session)}`;
}

function buildPricingReply(session) {
  const service = session.lead.service ? SERVICE_CATALOG[session.lead.service]?.label || session.lead.service : 'custom project';
  const volumeLine = session.lead.volume ? ` I noted **${session.lead.volume}** so far.` : '';
  return `Custom projects vary by scope.${volumeLine} To give an accurate range, how many **leads, accounts, users, or workflows** are involved, and is this mainly for **${service}**? ${bookingCTA(session)}`;
}

function buildEmergencyReply(session) {
  const crmName = session.lead.crmName ? ` in **${session.lead.crmName}**` : '';
  return `Understood — this sounds urgent${crmName}. Is this a **technical lockout**, or is a **critical workflow** like lead automation or follow-up broken right now? If you can share the exact failure in one line, I’ll narrow the fastest next step.`;
}

function buildVAReply(session) {
  return `Yes — we can scope VA support. Do you need a **full-time dedicated assistant** or **part-time support** for tasks like **inbox, calendar, research, CRM updates, or follow-up coordination**?`;
}

function buildCRMReply(session) {
  const crmName = session.lead.crmName;
  const issueType = session.lead.issueType;
  const intro = crmName
    ? `Got it — you need help with **${crmName}**.`
    : 'This sounds like a **CRM systems** issue.';
  const followUp = issueType
    ? ` I noted the likely issue as **${issueType}**.`
    : '';
  if (crmName) {
    return `${intro}${followUp} What is the main problem right now: **setup**, **messy data**, **automation**, **reporting**, **migration**, or **team usage**?`;
  }
  return `${intro}${followUp} Which CRM are you using now — **HubSpot**, **Salesforce**, **Zoho**, **Pipedrive**, or something else?`;
}

function buildLeadGenReply() {
  return `This sounds like a **lead generation** issue. Are you struggling more with **finding qualified leads**, **getting replies**, or **turning replies into booked meetings**?`;
}

function buildAccountReply() {
  return `This sounds like an **account management** issue. Is the main gap in **handover**, **follow-up consistency**, **retention**, or **client communication quality**?`;
}

function buildOperationsReply(session) {
  if (session.lead.issueType === 'sops') {
    return `Yes — CresscoX can support **SOP creation** and wider operations structure. Do you need SOPs mainly for **sales**, **CRM/admin work**, **client handovers**, or **internal operations**?`;
  }
  return `This sounds like an **operations** issue. Which part feels most disorganized right now — **workflow**, **ownership**, **approvals**, **reporting**, or **handover**?`;
}

function buildContactReply() {
  return `You can reach the team through the **contact** or **appointment** section on the site. If you want, send your **name**, **email**, **company**, and **main need**, and I’ll help you shape the inquiry first.`;
}

function buildFAQReply(session) {
  const faq = findFaqAnswer(session.lead.faqTopic);
  return faq ? faq.answer : '';
}

function buildLeadCaptureReply(session) {
  const lines = [];
  if (session.lead.name) lines.push(`**Name:** ${session.lead.name}`);
  if (session.lead.email) lines.push(`**Email:** ${session.lead.email}`);
  if (session.lead.company) lines.push(`**Company:** ${session.lead.company}`);
  if (session.lead.crmName) lines.push(`**CRM:** ${session.lead.crmName}`);
  if (session.lead.service) lines.push(`**Service:** ${SERVICE_CATALOG[session.lead.service]?.label || session.lead.service}`);
  if (session.lead.issueType) lines.push(`**Issue:** ${session.lead.issueType}`);
  if (!lines.length) return '';
  return `Here’s what I’ve captured so far:\n\n${lines.join('\n')}\n\nIf you want, add the **main goal** and **scope**, and I’ll help structure it before booking.`;
}

function buildGeneralReply(session) {
  const quickAreas = [
    'CRM systems',
    'lead generation',
    'account management',
    'operations support',
    'virtual assistance'
  ].join(', ');

  if (session.lead.crmName) {
    return `I can help with **${session.lead.crmName}**, lead generation, operations, and support workflows. Tell me the main issue and I’ll narrow it fast.`;
  }

  return `I can help with **${quickAreas}**. Tell me what you need help with, or say **HubSpot help**, **CRM audit**, **need more leads**, or **book a call**.`;
}

function generateReply(message, session) {
  applyEntities(session, message);

  const faqReply = buildFAQReply(session);
  if (faqReply) {
    session.lastIntent = 'faq';
    session.confidence = 0.95;
    updateStage(session);
    return faqReply;
  }

  const { intent, confidence } = classifyIntent(message);
  session.lastIntent = intent;
  session.confidence = confidence;

  const normalized = normalize(message);

  const looksLikeLeadCapture =
    !!extractEmail(message) ||
    !!extractName(message) ||
    !!extractCompany(message) ||
    (session.lastIntent === 'contact' && (session.lead.name || session.lead.email));

  if (looksLikeLeadCapture && !['greeting', 'smalltalk', 'thanks'].includes(intent)) {
    const leadCapture = buildLeadCaptureReply(session);
    if (leadCapture) {
      updateStage(session);
      return leadCapture;
    }
  }

  let reply = '';
  switch (intent) {
    case 'greeting':
      reply = buildGreetingReply(session);
      break;
    case 'smalltalk':
      reply = buildSmalltalkReply(session);
      break;
    case 'thanks':
      reply = buildThanksReply(session);
      break;
    case 'demo_request':
      reply = buildDemoReply(session);
      break;
    case 'audit_request':
      reply = buildAuditReply(session);
      break;
    case 'pricing_request':
      reply = buildPricingReply(session);
      break;
    case 'emergency_request':
      reply = buildEmergencyReply(session);
      break;
    case 'hire_va_request':
      reply = buildVAReply(session);
      break;
    case 'booking_request':
      reply = session.lead.crmName
        ? `Yes — we can set up a strategy call for **${session.lead.crmName}**. Is the main bottleneck **setup**, **automation**, **reporting**, or **cleanup**?`
        : `Yes — we can set up a strategy call. What is the **main bottleneck**: **CRM**, **lead generation**, **operations**, **account management**, or **VA support**?`;
      break;
    case 'crm_help':
      reply = buildCRMReply(session);
      break;
    case 'lead_generation':
      reply = buildLeadGenReply(session);
      break;
    case 'account_management':
      reply = buildAccountReply(session);
      break;
    case 'operations':
      reply = buildOperationsReply(session);
      break;
    case 'contact':
      reply = buildContactReply(session);
      break;
    default:
      reply = buildGeneralReply(session);
      break;
  }

  if (
    session.lead.service === 'crm_systems' &&
    session.lead.crmName &&
    !session.lead.issueType &&
    hasAny(normalized, ['problem', 'help', 'issue', 'struggling'])
  ) {
    reply = `Got it — you need help with **${session.lead.crmName}**. What is the main issue right now: **setup**, **messy data**, **automation**, **reporting**, **migration**, or **team usage**?`;
  }

  updateStage(session);
  return reply;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'cresscox-free-hybrid-chatbot' });
});

app.post('/api/chat', (req, res) => {
  try {
    const { sessionId, message } = req.body || {};
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required.' });
    }

    const session = getSession(sessionId);
    const cleanMessage = String(message).trim();

    session.history.push({ role: 'user', text: cleanMessage, at: Date.now() });
    session.history = session.history.slice(-BOT_CONFIG.maxHistory);

    const reply = generateReply(cleanMessage, session);

    session.history.push({ role: 'assistant', text: reply, at: Date.now() });
    session.history = session.history.slice(-BOT_CONFIG.maxHistory);

    return res.json({
      reply,
      sessionLead: session.lead,
      lastIntent: session.lastIntent,
      confidence: session.confidence,
      stage: session.stage,
      qualificationScore: qualificationScore(session)
    });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Unable to generate a reply right now.' });
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
  console.log(`CresscoX chatbot server running at http://localhost:${PORT}`);
});
