// Voice Recognition Module using Web Speech API (F-02)
// Configured for Indonesian (id-ID) per T8-3 & T8-4 specifications

let recognition = null;
let isRecording = false;
let activeRecordingSource = 'chat'; // 'chat' or 'floating'

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btnVoiceRecord = document.getElementById('btnVoiceRecord');
  const btnFloatingVoiceRecord = document.getElementById('btnFloatingVoiceRecord');

  if (!SpeechRecognition) {
    console.warn('Web Speech API is not supported in this browser. Hiding microphone buttons per T8-4.');
    if (btnVoiceRecord) btnVoiceRecord.style.display = 'none';
    if (btnFloatingVoiceRecord) btnFloatingVoiceRecord.style.display = 'none';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    isRecording = true;
    if (activeRecordingSource === 'floating') {
      const btn = document.getElementById('btnFloatingVoiceRecord');
      const mic = document.getElementById('floatingMicIcon');
      const input = document.getElementById('floatingChatInputText');
      if (btn) btn.classList.add('mic-active');
      if (mic) mic.className = 'fa-solid fa-microphone-lines text-xs animate-pulse';
      if (input) input.placeholder = 'Mendengarkan...';
    } else {
      const btn = document.getElementById('btnVoiceRecord');
      const mic = document.getElementById('micIcon');
      const input = document.getElementById('chatInputText');
      if (btn) btn.classList.add('mic-active');
      if (mic) mic.className = 'fa-solid fa-microphone-lines text-base animate-pulse';
      if (input) input.placeholder = 'Mendengarkan suara Anda... (Bicara sekarang)';
    }
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    const targetInput = activeRecordingSource === 'floating'
      ? document.getElementById('floatingChatInputText')
      : document.getElementById('chatInputText');
    if (targetInput) {
      targetInput.value = transcript;
    }
  };

  recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    stopVoiceRecording();
    if (event.error === 'not-allowed') {
      if (typeof showToast === 'function') {
        showToast('Izin mikrofon ditolak oleh browser.', 'error');
      } else {
        alert('Izin mikrofon ditolak browser.');
      }
    }
  };

  recognition.onend = () => {
    stopVoiceRecording();
    const targetInput = activeRecordingSource === 'floating'
      ? document.getElementById('floatingChatInputText')
      : document.getElementById('chatInputText');

    if (targetInput && targetInput.value.trim().length > 0) {
      setTimeout(() => {
        if (activeRecordingSource === 'floating') {
          handleSendFloatingChat();
        } else {
          handleSendChatWithSource('voice');
        }
      }, 400);
    }
  };
}

function toggleVoiceRecording() {
  activeRecordingSource = 'chat';
  startOrStopRecognition();
}

function toggleFloatingVoiceRecording() {
  activeRecordingSource = 'floating';
  startOrStopRecognition();
}

function startOrStopRecognition() {
  if (!recognition) {
    if (typeof showToast === 'function') {
      showToast('Browser Anda tidak mendukung Web Speech API.', 'warning');
    } else {
      alert('Browser Anda tidak mendukung Web Speech API.');
    }
    return;
  }

  if (isRecording) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
    }
  }
}

function stopVoiceRecording() {
  isRecording = false;

  const btnVoiceRecord = document.getElementById('btnVoiceRecord');
  const micIcon = document.getElementById('micIcon');
  const chatInput = document.getElementById('chatInputText');
  if (btnVoiceRecord) btnVoiceRecord.classList.remove('mic-active');
  if (micIcon) micIcon.className = 'fa-solid fa-microphone text-base';
  if (chatInput) chatInput.placeholder = "Ketik transaksi, misal: 'makan siang 15rb' atau 'beli bensin 25k'...";

  const btnFloatingVoice = document.getElementById('btnFloatingVoiceRecord');
  const flMicIcon = document.getElementById('floatingMicIcon');
  const flInput = document.getElementById('floatingChatInputText');
  if (btnFloatingVoice) btnFloatingVoice.classList.remove('mic-active');
  if (flMicIcon) flMicIcon.className = 'fa-solid fa-microphone text-xs';
  if (flInput) flInput.placeholder = "Ketik transaksi...";
}

document.addEventListener('DOMContentLoaded', initVoiceRecognition);
