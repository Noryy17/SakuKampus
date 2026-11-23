// Main App Controller for SakuKampus UMY

let currentUser = null;
let currentView = 'dashboard';
let currentAddType = 'expense';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initModalListeners();
  await checkAuth();
  await loadCategories();
  await loadDashboardData();
  await loadTransactions();
});

// Toast Notification System (Achievement Style)
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const id = 'toast-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'toast-item pointer-events-auto p-4 rounded-btn border-2 flex items-center gap-3 text-xs font-semibold shadow-card';

  let colors = 'bg-white dark:bg-nightbg-card border-emerald-500 text-emerald-700 dark:text-emerald-400';
  let icon = '<i class="fa-solid fa-circle-check text-base text-emerald-600"></i>';

  if (type === 'error') {
    colors = 'bg-white dark:bg-nightbg-card border-red-500 text-red-600 dark:text-red-400';
    icon = '<i class="fa-solid fa-circle-xmark text-base text-red-500"></i>';
  } else if (type === 'warning') {
    colors = 'bg-white dark:bg-nightbg-card border-amber-500 text-amber-700 dark:text-amber-400';
    icon = '<i class="fa-solid fa-triangle-exclamation text-base text-amber-500"></i>';
  } else if (type === 'info') {
    colors = 'bg-white dark:bg-nightbg-card border-brand-500 text-brand-700 dark:text-brand-400';
    icon = '<i class="fa-solid fa-circle-info text-base text-brand-600"></i>';
  }

  div.className += ' ' + colors;
  div.innerHTML = `
    ${icon}
    <div class="flex-1 font-sans">${escapeHtml(message)}</div>
    <button onclick="document.getElementById('${id}').remove()" class="text-ink/40 hover:text-ink dark:text-nighttext/40 dark:hover:text-nighttext" aria-label="Tutup notifikasi">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(div);

  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      el.style.transition = 'all 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }
  }, 3500);
}

// View Navigation Switcher
function switchView(viewName) {
  currentView = viewName;
  // Automatically close mobile sidebar drawer on navigation!
  closeMobileMenu();

  // Hide floating assistant button when already in full chat view
  const floatingChat = document.getElementById('floatingChatContainer');
  if (floatingChat) {
    if (viewName === 'chat') {
      floatingChat.classList.add('hidden');
    } else {
      floatingChat.classList.remove('hidden');
    }
  }

  const views = ['dashboard', 'chat', 'history', 'about'];
  const titles = {
    dashboard: { title: 'Dashboard Keuangan', sub: 'Ringkasan saldo & transaksi pintar' },
    chat: { title: 'Catat Transaksi', sub: 'Chatbot pintar & rekognisi suara (id-ID)' },
    history: { title: 'Riwayat Transaksi', sub: 'Pencarian & manajemen transaksi keuangan' },
    about: { title: 'Manajemen Proyek TI', sub: 'Kelompok Team 7 · Metode Waterfall' }
  };

  // Toggle view containers
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    const navBtn = document.getElementById(`nav-${v}`);
    const mobileNavBtn = document.getElementById(`mobile-nav-${v}`);

    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }

    // Desktop nav styles
    if (navBtn) {
      if (v === viewName) {
        navBtn.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400';
      } else {
        navBtn.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800';
      }
    }

    // Mobile nav styles
    if (mobileNavBtn) {
      if (v === viewName) {
        mobileNavBtn.className = 'flex flex-col items-center gap-1 text-brand-600 dark:text-brand-400 text-xs font-semibold min-w-[44px] min-h-[44px] justify-center';
      } else {
        mobileNavBtn.className = 'flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500 hover:text-brand-600 text-xs min-w-[44px] min-h-[44px] justify-center';
      }
    }
  });

  // Topbar Title & Back Button Visibility
  const btnBack = document.getElementById('btnBackToDashboard');
  if (btnBack) {
    if (viewName === 'dashboard') {
      btnBack.classList.add('hidden');
      btnBack.classList.remove('inline-flex');
    } else {
      btnBack.classList.remove('hidden');
      btnBack.classList.add('inline-flex');
    }
  }

  if (titles[viewName]) {
    document.getElementById('topbarTitle').textContent = titles[viewName].title;
    document.getElementById('topbarSubtitle').textContent = titles[viewName].sub;
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Reload specific view data if needed
  if (viewName === 'dashboard') {
    loadDashboardData();
  } else if (viewName === 'history') {
    loadTransactions();
  }
}

// Global modal backdrop & escape key handling
function initModalListeners() {
  const modals = ['editModal', 'deleteModal', 'addModal'];
  modals.forEach(modalId => {
    const modalEl = document.getElementById(modalId);
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          if (modalId === 'editModal') closeEditModal();
          if (modalId === 'deleteModal') closeDeleteModal();
          if (modalId === 'addModal') closeAddModal();
        }
      });
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
      closeAddModal();
      closeFloatingChat();
      closeMobileMenu();
    }
  });
}

// MANUAL ADD TRANSACTION MODAL
function openAddModal() {
  const addModal = document.getElementById('addModal');
  const dateInput = document.getElementById('addDate');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  setAddType('expense');
  if (addModal) addModal.classList.remove('hidden');
}

function closeAddModal() {
  const addModal = document.getElementById('addModal');
  if (addModal) addModal.classList.add('hidden');
}

function setAddType(type) {
  currentAddType = type;
  const btnExp = document.getElementById('btnAddTypeExpense');
  const btnInc = document.getElementById('btnAddTypeIncome');

  if (type === 'expense') {
    if (btnExp) btnExp.className = 'flex-1 py-2 text-xs font-semibold active text-expense';
    if (btnInc) btnInc.className = 'flex-1 py-2 text-xs font-medium text-slate-500 dark:text-slate-400';
  } else {
    if (btnInc) btnInc.className = 'flex-1 py-2 text-xs font-semibold active text-emerald-600 dark:text-emerald-400';
    if (btnExp) btnExp.className = 'flex-1 py-2 text-xs font-medium text-slate-500 dark:text-slate-400';
  }

  // Populate categories according to selected type
  const select = document.getElementById('addCategory');
  if (select && allCategories) {
    const filtered = allCategories.filter(c => c.type === type);
    select.innerHTML = filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  }
}

async function handleSaveAdd(e) {
  e.preventDefault();
  const amount = document.getElementById('addAmount').value;
  const category_id = document.getElementById('addCategory').value;
  const description = document.getElementById('addDesc').value;
  const occurred_on = document.getElementById('addDate').value;

  try {
    const res = await api.post('/api/transactions', {
      amount,
      category_id,
      description,
      occurred_on
    });

    if (res.success) {
      closeAddModal();
      document.getElementById('addForm').reset();
      showToast('Transaksi berhasil ditambahkan!', 'success');
      loadDashboardData();
      loadTransactions();
    } else {
      showToast(res.error || 'Gagal menyimpan transaksi.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menyimpan transaksi.', 'error');
  }
}

// Reset filters in Riwayat Transaksi
function resetFilters() {
  const search = document.getElementById('filterSearch');
  const type = document.getElementById('filterType');
  const category = document.getElementById('filterCategory');
  const startDate = document.getElementById('filterStartDate');
  const endDate = document.getElementById('filterEndDate');

  if (search) search.value = '';
  if (type) type.value = '';
  if (category) category.value = '';
  if (startDate) startDate.value = '';
  if (endDate) endDate.value = '';

  loadTransactions();
  showToast('Filter riwayat telah direset.', 'info');
}

// Authentication Check (F-01, F-08)
async function checkAuth() {
  try {
    const res = await api.get('/auth/me');
    if (res.authenticated && res.user) {
      currentUser = res.user;
      document.getElementById('sidebarUserName').textContent = currentUser.name || 'Mahasiswa UMY';
      document.getElementById('sidebarUserEmail').textContent = currentUser.email || 'student@umy.ac.id';
      const cleanName = (currentUser.name || 'Dimas').replace(/\s*\(.*\)/, '').trim();
      const avatarPic = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`;
      const avatarEl = document.getElementById('sidebarUserAvatar');
      if (avatarEl) {
        avatarEl.src = avatarPic;
        avatarEl.style.imageRendering = 'auto';
      }
    } else {
      window.location.href = '/login.html';
    }
  } catch (err) {
    window.location.href = '/login.html';
  }
}

// Logout (F-01)
async function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari SakuKampus?')) {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // ignore
    }
    window.location.href = '/login.html';
  }
}

// Dark / Light Theme Support (Defaults to Crisp Clean White)
function initTheme() {
  const isDark = localStorage.getItem('theme') === 'dark';
  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  const mainThemeBtn = document.getElementById('mainThemeBtn');
  if (mainThemeBtn) {
    mainThemeBtn.addEventListener('click', () => {
      const isNowDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', isNowDark ? 'dark' : 'light');
      // Re-render charts with updated theme colors
      loadChartsData();
    });
  }
}

// Mobile Menu Drawer Management (Transform-based, bulletproof)
function openMobileMenu() {
  const sidebar = document.getElementById('mainSidebar');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  if (sidebar) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
  }
  if (backdrop) {
    backdrop.classList.remove('opacity-0', 'pointer-events-none');
    backdrop.classList.add('opacity-100', 'pointer-events-auto');
  }
}

function closeMobileMenu() {
  const sidebar = document.getElementById('mainSidebar');
  const backdrop = document.getElementById('mobileSidebarBackdrop');
  if (sidebar) {
    sidebar.classList.remove('translate-x-0');
    sidebar.classList.add('-translate-x-full');
  }
  if (backdrop) {
    backdrop.classList.remove('opacity-100', 'pointer-events-auto');
    backdrop.classList.add('opacity-0', 'pointer-events-none');
  }
}

function toggleMobileMenu() {
  const sidebar = document.getElementById('mainSidebar');
  if (sidebar && sidebar.classList.contains('translate-x-0')) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
}

// Window resize listener: if desktop width, ensure mobile classes don't trap the drawer
window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    closeMobileMenu();
  }
});
