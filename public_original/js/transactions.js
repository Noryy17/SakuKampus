// Transaction History, Filters & CRUD Operations (F-05, F-10)

let allCategories = [];
let pendingDeleteId = null;

async function loadCategories() {
  try {
    const res = await api.get('/api/transactions/meta/categories');
    if (res.success) {
      allCategories = res.data;

      // Populate filter dropdown
      const filterSelect = document.getElementById('filterCategory');
      if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Semua 12 Kategori</option>' +
          allCategories.map(c => `<option value="${c.id}">${c.name} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</option>`).join('');
      }

      // Populate edit modal dropdown
      const editSelect = document.getElementById('editCategory');
      if (editSelect) {
        editSelect.innerHTML = allCategories.map(c =>
          `<option value="${c.id}">${c.name} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</option>`
        ).join('');
      }
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

async function loadTransactions() {
  const search = document.getElementById('filterSearch')?.value.trim() || '';
  const type = document.getElementById('filterType')?.value || '';
  const category_id = document.getElementById('filterCategory')?.value || '';
  const start_date = document.getElementById('filterStartDate')?.value || '';
  const end_date = document.getElementById('filterEndDate')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (type) params.append('type', type);
  if (category_id) params.append('category_id', category_id);
  if (start_date) params.append('start_date', start_date);
  if (end_date) params.append('end_date', end_date);

  try {
    const res = await api.get(`/api/transactions?${params.toString()}`);
    if (res.success) {
      renderTransactionsTable(res.data);
    }
  } catch (err) {
    console.error('Error fetching transactions:', err);
  }
}

function renderTransactionsTable(transactions) {
  const tbody = document.getElementById('transactionTableBody');
  const emptyPlaceholder = document.getElementById('emptyTxPlaceholder');
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = '';
    emptyPlaceholder?.classList.remove('hidden');
    return;
  }

  emptyPlaceholder?.classList.add('hidden');

  tbody.innerHTML = transactions.map(tx => {
    const isIncome = tx.category_type === 'income';
    const amountColor = isIncome ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-rose-600 dark:text-rose-400 font-extrabold';
    const prefix = isIncome ? '+' : '-';

    const sourceBadge = tx.source === 'voice'
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 text-[10px] font-semibold"><i class="fa-solid fa-microphone"></i> Suara</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-[10px] font-semibold"><i class="fa-solid fa-comment"></i> Chat</span>';

    const parserBadge = tx.parsed_by === 'llm'
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 text-[10px] font-semibold"><i class="fa-solid fa-robot"></i> Gemini</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-semibold"><i class="fa-solid fa-bolt"></i> Aturan</span>';

    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
        <td class="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">${tx.occurred_on}</td>
        <td class="py-4 px-6">
          <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(tx.description)}</p>
          ${tx.raw_text ? `<p class="text-[11px] text-slate-400 italic font-mono mt-0.5">"${escapeHtml(tx.raw_text)}"</p>` : ''}
        </td>
        <td class="py-4 px-6 whitespace-nowrap">
          <span class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${isIncome ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}">
            ${escapeHtml(tx.category_name)}
          </span>
        </td>
        <td class="py-4 px-6 text-center whitespace-nowrap space-x-1">
          ${sourceBadge}
          ${parserBadge}
        </td>
        <td class="py-4 px-6 text-right whitespace-nowrap ${amountColor}">
          ${prefix}${formatRupiah(tx.amount)}
        </td>
        <td class="py-4 px-6 text-center whitespace-nowrap">
          <div class="inline-flex items-center gap-1">
            <button onclick="openEditModal(${tx.id})" class="p-2 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Ubah (F-10)">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="openDeleteModal(${tx.id})" class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Hapus (F-10)">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

let filterDebounce = null;
function applyFilters() {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => {
    loadTransactions();
  }, 250);
}

// EDIT MODAL (F-10)
async function openEditModal(txId) {
  try {
    const res = await api.get(`/api/transactions/${txId}`);
    if (res.success) {
      const tx = res.data;
      document.getElementById('editTxId').value = tx.id;
      document.getElementById('editAmount').value = tx.amount;
      document.getElementById('editDesc').value = tx.description;
      document.getElementById('editDate').value = tx.occurred_on;

      // Populate edit categories if needed
      const editSelect = document.getElementById('editCategory');
      if (editSelect && allCategories.length > 0) {
        editSelect.innerHTML = allCategories.map(c =>
          `<option value="${c.id}">${c.name} (${c.type === 'income' ? 'Pemasukan' : 'Pengeluaran'})</option>`
        ).join('');
        editSelect.value = tx.category_id;
      }

      document.getElementById('editModal').classList.remove('hidden');
    }
  } catch (err) {
    showToast('Gagal mengambil data transaksi.', 'error');
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  if (modal) modal.classList.add('hidden');
}

async function handleSaveEdit(e) {
  e.preventDefault();
  const txId = document.getElementById('editTxId').value;
  const amount = document.getElementById('editAmount').value;
  const category_id = document.getElementById('editCategory').value;
  const description = document.getElementById('editDesc').value;
  const occurred_on = document.getElementById('editDate').value;

  try {
    const res = await api.put(`/api/transactions/${txId}`, {
      amount,
      category_id,
      description,
      occurred_on
    });

    if (res.success) {
      closeEditModal();
      showToast('Transaksi berhasil diperbarui!', 'success');
      loadTransactions();
      loadDashboardData();
    } else {
      showToast(res.error || 'Gagal menyimpan perubahan transaksi.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat menyimpan perubahan.', 'error');
  }
}

// DELETE MODAL (F-10)
function openDeleteModal(txId) {
  pendingDeleteId = txId;
  const modal = document.getElementById('deleteModal');
  const confirmBtn = document.getElementById('btnConfirmDelete');

  confirmBtn.onclick = async () => {
    try {
      const res = await api.delete(`/api/transactions/${pendingDeleteId}`);
      if (res.success) {
        closeDeleteModal();
        showToast('Transaksi berhasil dihapus.', 'info');
        loadTransactions();
        loadDashboardData();
      } else {
        showToast(res.error || 'Gagal menghapus transaksi.', 'error');
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat menghapus transaksi.', 'error');
    }
  };

  modal.classList.remove('hidden');
}

function closeDeleteModal() {
  pendingDeleteId = null;
  const modal = document.getElementById('deleteModal');
  if (modal) modal.classList.add('hidden');
}
