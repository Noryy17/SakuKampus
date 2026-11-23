// Dashboard & Chart.js Management (F-06, F-07)
// Supports Category Breakdown & Multi-period Financial Trend (Harian 7 Hari, 30 Hari, Bulanan)

let categoryChartInstance = null;
let trendChartInstance = null;
let cachedChartData = null;
let currentTrendPeriod = 'monthly'; // '7d', '30d', or 'monthly'

const CATEGORY_COLORS = {
  'Makan': '#f59e0b',
  'Transportasi': '#3b82f6',
  'Belanja': '#ec4899',
  'Tagihan': '#ef4444',
  'Hiburan': '#8b5cf6',
  'Kesehatan': '#10b981',
  'Pendidikan': '#06b6d4',
  'Lain-lain pengeluaran': '#64748b'
};

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num || 0);
}

async function loadDashboardData() {
  try {
    const summaryRes = await api.get('/api/dashboard/summary');
    if (summaryRes.success) {
      const data = summaryRes.data;

      // Update Top Stat Cards (F-06)
      const balanceEl = document.getElementById('statTotalBalance');
      balanceEl.textContent = formatRupiah(data.total_balance);
      if (data.total_balance < 0) {
        balanceEl.className = 'text-2xl font-extrabold text-rose-600 dark:text-rose-400';
      } else {
        balanceEl.className = 'text-2xl font-extrabold text-slate-900 dark:text-white';
      }

      document.getElementById('statMonthlyIncome').textContent = formatRupiah(data.monthly_income);
      document.getElementById('statMonthlyExpense').textContent = formatRupiah(data.monthly_expense);

      // Quota Counter (F-09)
      const quota = data.chat_quota;
      const quotaText = `${quota.remaining} / ${quota.limit}`;
      document.getElementById('statQuotaCount').textContent = quotaText;

      // Update Sidebar Quota
      const sidebarQuotaText = document.getElementById('sidebarQuotaText');
      const sidebarQuotaBar = document.getElementById('sidebarQuotaBar');
      if (sidebarQuotaText) sidebarQuotaText.textContent = `${quota.used}/${quota.limit}`;
      if (sidebarQuotaBar) {
        const pct = Math.max(0, Math.min(100, (quota.used / quota.limit) * 100));
        sidebarQuotaBar.style.width = `${pct}%`;
        if (pct >= 90) {
          sidebarQuotaBar.className = 'bg-rose-500 h-1.5 rounded-full transition-all duration-300';
        } else if (pct >= 70) {
          sidebarQuotaBar.className = 'bg-amber-500 h-1.5 rounded-full transition-all duration-300';
        } else {
          sidebarQuotaBar.className = 'bg-brand-600 h-1.5 rounded-full transition-all duration-300';
        }
      }

      // Update Chat Tag
      const chatQuotaTag = document.getElementById('chatQuotaTag');
      if (chatQuotaTag) chatQuotaTag.textContent = `Sisa: ${quota.remaining} Kuota`;

      // Render Recent 5 Transactions
      renderRecentTransactions(data.recent_transactions);
    }

    // Load and render Chart.js graphs (F-07)
    await loadChartsData();

  } catch (err) {
    console.error('Error loading dashboard data:', err);
  }
}

function renderRecentTransactions(transactions) {
  const container = document.getElementById('recentTxList');
  if (!container) return;

  if (!transactions || transactions.length === 0) {
    container.innerHTML = `
      <div class="py-8 text-center text-slate-400 text-xs">
        <i class="fa-solid fa-receipt text-2xl mb-2 opacity-40"></i>
        <p>Belum ada transaksi yang dicatat.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const isIncome = tx.category_type === 'income';
    const amountClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    const prefix = isIncome ? '+' : '-';
    const iconClass = isIncome ? 'fa-arrow-up text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60' : 'fa-arrow-down text-rose-600 bg-rose-100 dark:bg-rose-950/60';
    const sourceIcon = tx.source === 'voice' ? '🎙️' : '💬';

    return `
      <div class="py-3 flex items-center justify-between text-xs">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl ${iconClass} flex items-center justify-center shrink-0">
            <i class="fa-solid ${isIncome ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"></i>
          </div>
          <div>
            <p class="font-bold text-slate-800 dark:text-slate-100">${escapeHtml(tx.description)}</p>
            <p class="text-[11px] text-slate-400">${escapeHtml(tx.category_name)} · ${tx.occurred_on} · ${sourceIcon}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="font-extrabold ${amountClass}">${prefix}${formatRupiah(tx.amount)}</p>
        </div>
      </div>
    `;
  }).join('');
}

async function loadChartsData() {
  try {
    const res = await api.get('/api/dashboard/charts');
    if (!res.success) return;

    cachedChartData = res.data;
    const { category_breakdown } = cachedChartData;
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';

    // 1. Doughnut Chart: Kategori Pengeluaran
    const ctxCat = document.getElementById('categoryChart')?.getContext('2d');
    const emptyPlaceholder = document.getElementById('emptyCategoryChart');

    if (ctxCat) {
      if (!category_breakdown || category_breakdown.length === 0) {
        if (categoryChartInstance) categoryChartInstance.destroy();
        document.getElementById('categoryChart').style.display = 'none';
        emptyPlaceholder.classList.remove('hidden');
      } else {
        document.getElementById('categoryChart').style.display = 'block';
        emptyPlaceholder.classList.add('hidden');

        const labels = category_breakdown.map(c => c.name);
        const data = category_breakdown.map(c => c.total);
        const bgColors = labels.map(l => CATEGORY_COLORS[l] || '#059669');

        if (categoryChartInstance) categoryChartInstance.destroy();

        categoryChartInstance = new Chart(ctxCat, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: bgColors,
              borderWidth: 2,
              borderColor: isDark ? '#0f172a' : '#ffffff'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: textColor,
                  font: { family: 'Plus Jakarta Sans', size: 11 },
                  boxWidth: 12,
                  padding: 12
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    return ` ${context.label}: ${formatRupiah(context.parsed)}`;
                  }
                }
              }
            },
            cutout: '68%'
          }
        });
      }
    }

    // 2. Render Trend Chart with current period
    renderTrendChart();

  } catch (err) {
    console.error('Error loading chart data:', err);
  }
}

// Switch between '7d' (7 Hari), '30d' (30 Hari), and 'monthly' (Bulanan)
function setTrendPeriod(period) {
  currentTrendPeriod = period;

  const btn7d = document.getElementById('btnTrend7d');
  const btn30d = document.getElementById('btnTrend30d');
  const btnMonthly = document.getElementById('btnTrendMonthly');
  const titleEl = document.getElementById('trendChartTitle');
  const subEl = document.getElementById('trendChartSubtitle');

  const activeClass = 'px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-sm transition';
  const inactiveClass = 'px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition';

  if (btn7d) btn7d.className = period === '7d' ? activeClass : inactiveClass;
  if (btn30d) btn30d.className = period === '30d' ? activeClass : inactiveClass;
  if (btnMonthly) btnMonthly.className = period === 'monthly' ? activeClass : inactiveClass;

  if (period === '7d') {
    if (titleEl) titleEl.textContent = 'Tren Harian (7 Hari Terakhir)';
    if (subEl) subEl.textContent = 'Pemasukan vs Pengeluaran 7 hari ke belakang';
  } else if (period === '30d') {
    if (titleEl) titleEl.textContent = 'Tren Harian (30 Hari Terakhir)';
    if (subEl) subEl.textContent = 'Aktivitas pemasukan vs pengeluaran sebulan terakhir';
  } else {
    if (titleEl) titleEl.textContent = 'Tren Bulanan';
    if (subEl) subEl.textContent = 'Pemasukan vs Pengeluaran 6 bulan terakhir';
  }

  renderTrendChart();
}

function renderTrendChart() {
  if (!cachedChartData) return;
  const ctxTrend = document.getElementById('trendChart')?.getContext('2d');
  if (!ctxTrend) return;

  let trendDataset = [];
  if (currentTrendPeriod === '7d') {
    trendDataset = cachedChartData.daily_trend_7d || [];
  } else if (currentTrendPeriod === '30d') {
    trendDataset = cachedChartData.daily_trend_30d || [];
  } else {
    trendDataset = cachedChartData.monthly_trend || [];
  }

  const isDark = document.documentElement.classList.contains('dark');
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';

  const labels = trendDataset.map(d => d.label || d.month);
  const incomeData = trendDataset.map(d => d.income);
  const expenseData = trendDataset.map(d => d.expense);

  if (trendChartInstance) trendChartInstance.destroy();

  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          tension: 0.35,
          fill: true,
          pointRadius: currentTrendPeriod === '30d' ? 2 : 4,
          pointBackgroundColor: '#10b981'
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.08)',
          tension: 0.35,
          fill: true,
          pointRadius: currentTrendPeriod === '30d' ? 2 : 4,
          pointBackgroundColor: '#ef4444'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            boxWidth: 12
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatRupiah(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: currentTrendPeriod === '30d' ? 9 : 10 },
            maxRotation: currentTrendPeriod === '30d' ? 45 : 0
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Plus Jakarta Sans', size: 10 },
            callback: function(value) {
              if (value >= 1000000) return (value / 1000000) + ' jt';
              if (value >= 1000) return (value / 1000) + ' rb';
              return value;
            }
          }
        }
      }
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
