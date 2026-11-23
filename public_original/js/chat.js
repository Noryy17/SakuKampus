// Chatbot Interaction Module (F-02, F-03, F-04, F-09, F-10)
// Supports both Full-page Chat View and Floating Chat Assistant on Dashboard

let isFloatingChatOpen = false;

// ==========================================
// 1. FLOATING CHAT ASSISTANT (FAB) LOGIC
// ==========================================

function toggleFloatingChat() {
  const windowEl = document.getElementById('floatingChatWindow');
  const iconEl = document.getElementById('floatingChatIcon');
  const toggleBtn = document.getElementById('floatingChatToggleBtn');

  if (!windowEl) return;

  isFloatingChatOpen = !isFloatingChatOpen;

  if (isFloatingChatOpen) {
    windowEl.classList.remove('hidden');
    if (iconEl) iconEl.className = 'fa-solid fa-xmark';
    if (toggleBtn) {
      toggleBtn.title = 'Tutup SakuBot (X)';
      toggleBtn.classList.add('bg-slate-700', 'hover:bg-slate-800');
      toggleBtn.classList.remove('bg-brand-600', 'hover:bg-brand-700');
    }
    // Focus input
    setTimeout(() => {
      document.getElementById('floatingChatInputText')?.focus();
    }, 150);
  } else {
    windowEl.classList.add('hidden');
    if (iconEl) iconEl.className = 'fa-solid fa-comments';
    if (toggleBtn) {
      toggleBtn.title = 'Buka SakuBot Asisten';
      toggleBtn.classList.remove('bg-slate-700', 'hover:bg-slate-800');
      toggleBtn.classList.add('bg-brand-600', 'hover:bg-brand-700');
    }
  }
}

function closeFloatingChat() {
  const windowEl = document.getElementById('floatingChatWindow');
  const iconEl = document.getElementById('floatingChatIcon');
  const toggleBtn = document.getElementById('floatingChatToggleBtn');

  if (windowEl && !windowEl.classList.contains('hidden')) {
    isFloatingChatOpen = false;
    windowEl.classList.add('hidden');
    if (iconEl) iconEl.className = 'fa-solid fa-comments';
    if (toggleBtn) {
      toggleBtn.title = 'Buka SakuBot Asisten';
      toggleBtn.classList.remove('bg-slate-700', 'hover:bg-slate-800');
      toggleBtn.classList.add('bg-brand-600', 'hover:bg-brand-700');
    }
  }
}

function setFloatingChatInput(text) {
  const input = document.getElementById('floatingChatInputText');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function handleSendFloatingChat(event) {
  if (event) event.preventDefault();
  const input = document.getElementById('floatingChatInputText');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';

  // Append user bubble to floating chat
  appendFloatingUserMessage(message);
  const typingId = appendFloatingTyping();

  try {
    const res = await api.post('/api/chat', { message, source: 'chat' });
    removeFloatingTyping(typingId);

    // Update Quota Tag & Sidebar
    updateQuotaUI(res.usage);

    if (res.is_rate_limited) {
      appendFloatingBotMessage(res.message, 'warning');
      showToast('Batas kuota chat tercapai.', 'warning');
      return;
    }

    if (res.is_consultation) {
      appendFloatingBotMessage(res.bot_reply, 'consultation');
      return;
    }

    if (res.is_unrecognized) {
      appendFloatingBotMessage(res.bot_reply, 'unrecognized');
      return;
    }

    if (res.success && res.transaction) {
      appendFloatingBotSuccess(res.transaction);
      showToast(`Transaksi ${res.transaction.category_name} berhasil dicatat!`, 'success');
      loadDashboardData();
      loadTransactions();
    } else {
      appendFloatingBotMessage('Maaf, terjadi kesalahan.', 'error');
    }

  } catch (err) {
    removeFloatingTyping(typingId);
    appendFloatingBotMessage('Gagal terhubung ke server.', 'error');
  }
}

function appendFloatingUserMessage(text) {
  const container = document.getElementById('floatingChatMessages');
  const div = document.createElement('div');
  div.className = 'flex justify-end items-start gap-1.5 fade-in';
  div.innerHTML = `
    <div class="max-w-[85%] bg-brand-600 text-white p-2.5 rounded-2xl chat-bubble-user text-xs shadow-sm">
      <p class="leading-relaxed">${escapeHtml(text)}</p>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendFloatingTyping() {
  const container = document.getElementById('floatingChatMessages');
  const id = 'fl-typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start gap-2 fade-in';
  div.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="bg-slate-100 dark:bg-slate-800 text-slate-500 p-2.5 rounded-2xl chat-bubble-bot text-[11px] flex items-center gap-1">
      <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
      <span class="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeFloatingTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendFloatingBotMessage(text, type = 'normal') {
  const container = document.getElementById('floatingChatMessages');
  const div = document.createElement('div');
  div.className = 'flex items-start gap-2 fade-in';

  let bubbleBg = 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
  let icon = '<i class="fa-solid fa-robot"></i>';

  if (type === 'consultation') {
    bubbleBg = 'bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-900/60 text-slate-800 dark:text-slate-200 shadow-sm';
    icon = '<i class="fa-solid fa-graduation-cap"></i>';
  } else if (type === 'warning') {
    bubbleBg = 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200';
    icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else if (type === 'error') {
    bubbleBg = 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border border-rose-200';
    icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  }

  const formatted = escapeHtml(text).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  div.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
      ${icon}
    </div>
    <div class="max-w-[85%] ${bubbleBg} p-2.5 rounded-2xl chat-bubble-bot text-xs leading-relaxed shadow-sm">
      ${formatted}
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function appendFloatingBotSuccess(tx) {
  const container = document.getElementById('floatingChatMessages');
  const div = document.createElement('div');
  div.className = 'flex items-start gap-2 fade-in';

  const isIncome = tx.category_type === 'income';
  const amountColor = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const prefix = isIncome ? '+' : '-';

  div.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
      <i class="fa-solid fa-check"></i>
    </div>
    <div class="max-w-[85%] bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl chat-bubble-bot text-xs leading-relaxed shadow-sm space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(tx.category_name)}</span>
        <span class="text-[10px] text-slate-400">${tx.occurred_on}</span>
      </div>
      <p class="text-sm font-extrabold ${amountColor}">${prefix}${formatRupiah(tx.amount)}</p>
      <p class="text-[11px] text-slate-500 truncate">${escapeHtml(tx.description)}</p>
      <div class="pt-1.5 flex gap-1.5 border-t border-slate-200/60 dark:border-slate-700">
        <button onclick="openEditModal(${tx.id})" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
          Ubah
        </button>
        <button onclick="openDeleteModal(${tx.id})" class="px-2 py-1 rounded-lg bg-white dark:bg-slate-700 text-[10px] font-bold text-rose-600 border border-slate-200 dark:border-slate-600">
          Hapus
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==========================================
// 2. FULL-PAGE CHAT VIEW LOGIC
// ==========================================

function setChatInput(text) {
  const input = document.getElementById('chatInputText');
  if (input) {
    input.value = text;
    input.focus();
  }
}

async function handleSendChat(event) {
  if (event) event.preventDefault();
  handleSendChatWithSource('chat');
}

async function handleSendChatWithSource(source = 'chat') {
  const input = document.getElementById('chatInputText');
  const message = input.value.trim();
  if (!message) return;

  // Clear input
  input.value = '';

  // Append user bubble
  appendUserMessage(message, source);

  // Show typing indicator
  const typingId = appendTypingIndicator();

  try {
    const res = await api.post('/api/chat', { message, source });
    removeTypingIndicator(typingId);

    // Update Quota Tag & Sidebar (F-09)
    updateQuotaUI(res.usage);

    if (res.is_rate_limited) {
      appendBotMessage(res.message, 'warning');
      showToast('Batas kuota pesan harian tercapai (F-09).', 'warning');
      return;
    }

    if (res.is_consultation) {
      appendBotMessage(res.bot_reply, 'consultation');
      return;
    }

    if (res.is_unrecognized) {
      appendBotMessage(res.bot_reply, 'unrecognized');
      return;
    }

    if (res.success && res.transaction) {
      appendBotTransactionSuccess(res.bot_reply, res.transaction);
      showToast(`Transaksi ${res.transaction.category_name} berhasil dicatat!`, 'success');
      // Refresh dashboard & transaction table in background
      loadDashboardData();
      loadTransactions();
    } else {
      appendBotMessage('Maaf, terjadi kesalahan saat memproses permintaan.', 'error');
    }

  } catch (err) {
    removeTypingIndicator(typingId);
    appendBotMessage('Gagal terhubung ke server SakuKampus. Periksa koneksi Anda.', 'error');
  }
}

function updateQuotaUI(usage) {
  if (!usage) return;
  const quotaTag = document.getElementById('chatQuotaTag');
  if (quotaTag) quotaTag.textContent = `Sisa: ${usage.remaining} Kuota`;

  const sidebarQuotaText = document.getElementById('sidebarQuotaText');
  const sidebarQuotaBar = document.getElementById('sidebarQuotaBar');
  if (sidebarQuotaText) sidebarQuotaText.textContent = `${usage.used}/${usage.limit}`;
  if (sidebarQuotaBar) {
    const pct = Math.max(0, Math.min(100, (usage.used / usage.limit) * 100));
    sidebarQuotaBar.style.width = `${pct}%`;
  }

  const statQuota = document.getElementById('statQuotaCount');
  if (statQuota) statQuota.textContent = `${usage.remaining} / ${usage.limit}`;
}

function appendUserMessage(text, source) {
  const container = document.getElementById('chatMessages');
  const sourceIcon = source === 'voice' ? '🎙️ ' : '';

  const div = document.createElement('div');
  div.className = 'flex justify-end items-start gap-2 fade-in';
  div.innerHTML = `
    <div class="max-w-[80%] bg-brand-600 text-white p-3.5 rounded-2xl chat-bubble-user text-sm shadow-sm">
      <p class="leading-relaxed">${sourceIcon}${escapeHtml(text)}</p>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function appendTypingIndicator() {
  const container = document.getElementById('chatMessages');
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'flex items-start gap-3 fade-in';
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs shrink-0 mt-1">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="bg-slate-100 dark:bg-slate-800 text-slate-500 p-3.5 rounded-2xl chat-bubble-bot text-xs flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce"></span>
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]"></span>
      <span class="w-2 h-2 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]"></span>
      <span class="ml-1 text-[11px]">SakuBot sedang membaca...</span>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendBotMessage(text, type = 'normal') {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'flex items-start gap-3 fade-in';

  let bubbleBg = 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200';
  let icon = '<i class="fa-solid fa-robot"></i>';

  if (type === 'consultation') {
    bubbleBg = 'bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-900/60 text-slate-800 dark:text-slate-100 shadow-sm';
    icon = '<i class="fa-solid fa-graduation-cap"></i>';
  } else if (type === 'warning') {
    bubbleBg = 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200';
    icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
  } else if (type === 'unrecognized') {
    bubbleBg = 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';
    icon = '<i class="fa-solid fa-circle-question"></i>';
  } else if (type === 'error') {
    bubbleBg = 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200';
    icon = '<i class="fa-solid fa-circle-exclamation"></i>';
  }

  // Format line breaks and bold
  const formatted = escapeHtml(text)
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs shrink-0 mt-1">
      ${icon}
    </div>
    <div class="max-w-[85%] ${bubbleBg} p-4 rounded-2xl chat-bubble-bot text-sm leading-relaxed shadow-sm">
      ${formatted}
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function appendBotTransactionSuccess(botReply, tx) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'flex items-start gap-3 fade-in';

  const isIncome = tx.category_type === 'income';
  const prefix = isIncome ? '+' : '-';
  const amountColor = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const badgeColor = isIncome ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300';

  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs shrink-0 mt-1">
      <i class="fa-solid fa-check"></i>
    </div>
    <div class="max-w-[85%] bg-slate-100 dark:bg-slate-800 p-4 rounded-2xl chat-bubble-bot text-sm leading-relaxed shadow-sm space-y-3">
      <div>
        <span class="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeColor} mb-1">
          ${isIncome ? 'Pemasukan' : 'Pengeluaran'} · ${escapeHtml(tx.category_name)}
        </span>
        <h4 class="font-bold text-slate-900 dark:text-white text-base">${escapeHtml(tx.description)}</h4>
        <p class="text-xl font-extrabold ${amountColor} mt-1">${prefix}${formatRupiah(tx.amount)}</p>
        <p class="text-xs text-slate-400 mt-1"><i class="fa-regular fa-calendar mr-1"></i>${tx.occurred_on} · ${tx.parsed_by === 'llm' ? '🤖 AI Gemini' : '⚡ Aturan'}</p>
      </div>

      <!-- Quick Action Buttons right inside chat (F-10) -->
      <div class="pt-2 border-t border-slate-200/60 dark:border-slate-700 flex items-center gap-2">
        <button onclick="openEditModal(${tx.id})" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition flex items-center gap-1.5 shadow-sm">
          <i class="fa-solid fa-pen-to-square text-brand-600"></i> Ubah
        </button>
        <button onclick="openDeleteModal(${tx.id})" class="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-semibold border border-slate-200 dark:border-slate-600 transition flex items-center gap-1.5 shadow-sm">
          <i class="fa-solid fa-trash-can"></i> Hapus
        </button>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}
