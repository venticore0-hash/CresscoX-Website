(function () {
  const config = {
    apiBaseUrl: window.CX_CHATBOT_API_BASE_URL || 'http://localhost:3000',
    assistantName: window.CX_CHATBOT_ASSISTANT_NAME || 'CresscoX Concierge',
    companyName: window.CX_CHATBOT_COMPANY_NAME || 'CresscoX',
    welcomeMessage:
      window.CX_CHATBOT_WELCOME_MESSAGE ||
      "Welcome to CresscoX. Tell me what is slowing your business down right now—lead generation, CRM setup, follow-up, operations, client handling, admin overload, or something else. I’ll respond like a real consultant and ask focused follow-up questions when needed.",
  };

  const storageKey = 'cx_chatbot_session_id';
  const sessionId = getOrCreateSessionId();
  let isOpen = false;
  let isSending = false;

  const root = document.createElement('div');
  root.className = 'cx-chatbot-root';
  root.innerHTML = `
    <div class="cx-chatbot-toggle-wrap">
      <div class="cx-chatbot-bubble">Ask about business growth, CRM, operations, client handling, outreach, or workflow bottlenecks.</div>
      <button class="cx-chatbot-toggle" type="button" aria-label="Open chatbot">
        <span class="cx-chatbot-ping"></span>
        <i class="fa-solid fa-robot"></i>
      </button>
    </div>

    <section class="cx-chatbot-window" aria-label="${escapeHtml(config.assistantName)}">
      <header class="cx-chatbot-header">
        <div class="cx-chatbot-brand">
          <h3 class="cx-chatbot-title">${escapeHtml(config.assistantName)}</h3>
          <div class="cx-chatbot-subtitle">Business-focused AI assistant with live conversation memory</div>
        </div>
        <div class="cx-chatbot-header-actions">
          <button class="cx-chatbot-icon-btn" type="button" data-action="reset" title="Start new chat">
            <i class="fa-solid fa-rotate-left"></i>
          </button>
          <button class="cx-chatbot-icon-btn" type="button" data-action="close" title="Close chat">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      <div class="cx-chatbot-intro">
        <div class="cx-chatbot-badges">
          <span class="cx-chatbot-badge">Floating chatbot UI</span>
          <span class="cx-chatbot-badge">AI brain</span>
          <span class="cx-chatbot-badge">Memory</span>
          <span class="cx-chatbot-badge">Business assistant</span>
        </div>
      </div>

      <div class="cx-chatbot-body" id="cxChatBody"></div>

      <footer class="cx-chatbot-footer">
        <form class="cx-chatbot-form" id="cxChatForm">
          <div class="cx-chatbot-input-wrap">
            <textarea class="cx-chatbot-textarea" id="cxChatInput" placeholder="Describe your problem in your own words..." rows="1"></textarea>
            <div class="cx-chatbot-meta">
              <span>Natural conversation • no forced options</span>
              <span id="cxChatCounter">0 / 3000</span>
            </div>
          </div>
          <button class="cx-chatbot-send" id="cxChatSend" type="submit" aria-label="Send message">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
        <div class="cx-chatbot-note">For best results, connect this widget to your backend with your OpenAI API key on the server only.</div>
      </footer>
    </section>
  `;

  document.body.appendChild(root);

  const toggleBtn = root.querySelector('.cx-chatbot-toggle');
  const closeBtn = root.querySelector('[data-action="close"]');
  const resetBtn = root.querySelector('[data-action="reset"]');
  const bodyEl = root.querySelector('#cxChatBody');
  const formEl = root.querySelector('#cxChatForm');
  const inputEl = root.querySelector('#cxChatInput');
  const sendBtn = root.querySelector('#cxChatSend');
  const counterEl = root.querySelector('#cxChatCounter');

  requestAnimationFrame(() => root.classList.add('ready'));
  renderAssistantMessage(config.welcomeMessage, true);
  renderStarters();

  toggleBtn.addEventListener('click', () => {
    isOpen = true;
    root.classList.add('open');
    inputEl.focus();
  });

  closeBtn.addEventListener('click', () => {
    isOpen = false;
    root.classList.remove('open');
  });

  resetBtn.addEventListener('click', async () => {
    try {
      await fetch(`${config.apiBaseUrl}/api/chat/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.warn('Reset failed on server:', error);
    }

    bodyEl.innerHTML = '';
    renderAssistantMessage(config.welcomeMessage, true);
    renderStarters();
    inputEl.focus();
  });

  inputEl.addEventListener('input', () => {
    autoResize(inputEl);
    counterEl.textContent = `${inputEl.value.length} / 3000`;
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formEl.requestSubmit();
    }
  });

  formEl.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = inputEl.value.trim();
    if (!message || isSending) return;

    removeStarters();
    renderUserMessage(message);
    inputEl.value = '';
    autoResize(inputEl);
    counterEl.textContent = '0 / 3000';

    const typingId = renderTyping();
    setSendingState(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          pageContext: {
            title: document.title,
            url: window.location.href,
            company: config.companyName,
          },
        }),
      });

      const data = await response.json();
      removeTyping(typingId);

      if (!response.ok) {
        throw new Error(data.error || 'Unable to get a response right now.');
      }

      renderAssistantMessage(data.reply || 'I could not generate a reply right now.');
    } catch (error) {
      removeTyping(typingId);
      renderAssistantMessage(
        `I’m having trouble reaching the AI backend right now. Please check that your Node server is running and that OPENAI_API_KEY is set correctly.\n\nTechnical note: ${error.message}`
      );
    } finally {
      setSendingState(false);
    }
  });

  function renderStarters() {
    const wrapper = document.createElement('div');
    wrapper.className = 'cx-chatbot-starters';
    wrapper.id = 'cxChatStarters';

    const starters = [
      'We are getting leads, but not enough of them become booked calls.',
      'Our CRM is messy and the team is not updating it properly.',
      'Client follow-up is inconsistent and deals are slipping.',
      'I need help structuring outreach, operations, and reporting.',
    ];

    starters.forEach((text) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cx-chatbot-starter';
      btn.textContent = text;
      btn.addEventListener('click', () => {
        inputEl.value = text;
        autoResize(inputEl);
        counterEl.textContent = `${text.length} / 3000`;
        formEl.requestSubmit();
      });
      wrapper.appendChild(btn);
    });

    bodyEl.appendChild(wrapper);
    scrollToBottom();
  }

  function removeStarters() {
    const starters = document.getElementById('cxChatStarters');
    if (starters) starters.remove();
  }

  function renderUserMessage(text) {
    renderMessage('user', text);
  }

  function renderAssistantMessage(text, isFirst = false) {
    renderMessage('assistant', text);
    if (isFirst) {
      scrollToBottom();
    }
  }

  function renderMessage(role, text) {
    const row = document.createElement('div');
    row.className = `cx-chat-msg-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = `cx-chat-msg ${role}`;
    bubble.innerHTML = formatMessage(text);

    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
  }

  function renderTyping() {
    const id = `typing-${Date.now()}`;
    const row = document.createElement('div');
    row.className = 'cx-chat-msg-row assistant';
    row.id = id;

    const bubble = document.createElement('div');
    bubble.className = 'cx-chat-msg assistant';
    bubble.innerHTML = '<div class="cx-chat-typing"><span></span><span></span><span></span></div>';

    row.appendChild(bubble);
    bodyEl.appendChild(row);
    scrollToBottom();
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function setSendingState(value) {
    isSending = value;
    sendBtn.disabled = value;
    inputEl.disabled = value;
  }

  function scrollToBottom() {
    bodyEl.scrollTop = bodyEl.scrollHeight;
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }

  function getOrCreateSessionId() {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `cx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(storageKey, id);
    return id;
  }

  function formatMessage(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
})();
