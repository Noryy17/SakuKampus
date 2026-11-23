// Dashboard & Chart.js Management (F-06, F-07)
// Supports Category Breakdown & Multi-period Financial Trend (Harian 7 Hari, 30 Hari, Bulanan)

let categoryChartInstance = null;
let trendChartInstance = null;
let cachedChartData = null;
let currentTrendPeriod = '7d'; // '7d', '30d', or 'monthly'

const CATEGORY_COLORS = {
  'Makan': '#FB923C',                // Warm orange (Seimart sign accent)
  'Transportasi': '#38BDF8',         // Vivid sky blue
  'Belanja': '#2563EB',              // Hokkaido poster royal blue
  'Tagihan': '#F87171',              // Soft coral red
  'Hiburan': '#818CF8',              // Soft periwinkle
  'Kesehatan': '#2DD4BF',            // Fresh soft teal
  'Pendidikan': '#60A5FA',           // Hokkaido powder sky
  'Lain-lain pengeluaran': '#94A3B8' // Clean soft slate
};

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(num || 0);
}

function getCategoryIcon(name, type) {
  const iconMap = {
    'Makan': 'fa-utensils',
    'Transportasi': 'fa-bicycle',
    'Belanja': 'fa-bag-shopping',
    'Tagihan': 'fa-receipt',
    'Hiburan': 'fa-gamepad',
    'Kesehatan': 'fa-heart-pulse',
    'Pendidikan': 'fa-graduation-cap',
    'Lain-lain pengeluaran': 'fa-boxes-stacked',
    'Gaji': 'fa-money-bill-wave',
    'Uang Saku': 'fa-hand-holding-dollar',
    'Bonus': 'fa-gift',
    'Lain-lain pemasukan': 'fa-coins'
  };
  const icon = iconMap[name] || (type === 'income' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down');
  return `<i class="fa-solid ${icon}"></i>`;
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
        balanceEl.className = 'text-3xl sm:text-4xl font-extrabold text-expense dark:text-expense-light tabular-nums';
      } else {
        balanceEl.className = 'text-3xl sm:text-4xl font-extrabold text-ink dark:text-nighttext tabular-nums';
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
          sidebarQuotaBar.className = 'bg-red-500 h-1.5 rounded-full transition-all duration-300';
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
      <div class="py-8 text-center text-ink/40 dark:text-nighttext/40 text-xs font-sans">
        <i class="fa-solid fa-receipt text-2xl mb-2 opacity-40"></i>
        <p>Belum ada transaksi yang dicatat.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const isIncome = tx.category_type === 'income';
    const amountClass = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
    const prefix = isIncome ? '+' : '-';
    const iconClass = isIncome
      ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
      : 'text-red-500 bg-red-50 dark:bg-red-950/40';
    const catIcon = getCategoryIcon(tx.category_name, tx.category_type);
    const sourceIcon = tx.source === 'voice'
      ? '<span class="badge-sand text-[10px]"><i class="fa-solid fa-microphone text-[9px]"></i> Suara</span>'
      : '<span class="badge-sand text-[10px]"><i class="fa-solid fa-comment text-[9px]"></i> Chat</span>';

    return `
      <div class="py-3.5 flex items-center justify-between text-xs font-sans">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl ${iconClass} flex items-center justify-center shrink-0 text-sm">
            ${catIcon}
          </div>
          <div>
            <p class="font-bold text-ink dark:text-nighttext">${escapeHtml(tx.description)}</p>
            <div class="flex items-center gap-1.5 text-[11px] text-ink/50 dark:text-nighttext/50 mt-0.5">
              <span>${escapeHtml(tx.category_name)}</span>
              <span>·</span>
              <span>${tx.occurred_on}</span>
              <span>·</span>
              ${sourceIcon}
            </div>
          </div>
        </div>
        <div class="text-right">
          <p class="font-extrabold ${amountClass} tabular-nums text-sm">${prefix}${formatRupiah(tx.amount)}</p>
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

    // 1. Doughnut Chart: Kategori Pengeluaran (Interactive AI Center & Smooth Spring Physics)
    const ctxCat = document.getElementById('categoryChart')?.getContext('2d');
    const emptyPlaceholder = document.getElementById('emptyCategoryChart');
    const centerDisplay = document.getElementById('doughnutCenterText');
    const catBadge = document.getElementById('catTotalBadge');

    if (ctxCat) {
      if (!category_breakdown || category_breakdown.length === 0) {
        if (categoryChartInstance) categoryChartInstance.destroy();
        document.getElementById('categoryChart').style.display = 'none';
        if (centerDisplay) centerDisplay.style.display = 'none';
        emptyPlaceholder.classList.remove('hidden');
      } else {
        document.getElementById('categoryChart').style.display = 'block';
        if (centerDisplay) centerDisplay.style.display = 'flex';
        emptyPlaceholder.classList.add('hidden');

        const labels = category_breakdown.map(c => c.name);
        const data = category_breakdown.map(c => c.total);
        const totalExp = data.reduce((a, b) => a + b, 0);
        const bgColors = labels.map(l => CATEGORY_COLORS[l] || '#38BDF8');

        if (catBadge) {
          catBadge.textContent = `${labels.length} Kategori`;
        }

        // Set initial center values
        const centerLabel = document.getElementById('doughnutCenterLabel');
        const centerValue = document.getElementById('doughnutCenterValue');
        const centerSub = document.getElementById('doughnutCenterSub');

        const resetCenter = () => {
          if (centerLabel) {
            centerLabel.textContent = 'Total Pengeluaran';
            centerLabel.style.color = '';
          }
          if (centerValue) centerValue.textContent = formatRupiah(totalExp);
          if (centerSub) centerSub.textContent = `${labels.length} Kategori Aktif`;
        };
        resetCenter();

        if (categoryChartInstance) categoryChartInstance.destroy();

        categoryChartInstance = new Chart(ctxCat, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: bgColors,
              borderWidth: 2,
              borderColor: isDark ? '#111C3A' : '#ffffff',
              borderRadius: 6,
              spacing: 4,
              hoverOffset: 14,
              hoverBorderWidth: 3,
              hoverBorderColor: isDark ? '#38BDF8' : '#2563EB'
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '74%',
            animation: {
              animateRotate: true,
              animateScale: true,
              duration: 1600,
              easing: 'easeOutQuart'
            },
            onHover: (event, activeElements) => {
              if (!centerLabel || !centerValue || !centerSub) return;
              if (activeElements && activeElements.length > 0) {
                const idx = activeElements[0].index;
                const catName = labels[idx];
                const catVal = data[idx];
                const pct = totalExp > 0 ? ((catVal / totalExp) * 100).toFixed(1) : 0;
                const color = bgColors[idx];

                centerLabel.textContent = catName;
                centerLabel.style.color = color;
                centerValue.textContent = formatRupiah(catVal);
                centerSub.textContent = `${pct}% dari total`;
              } else {
                resetCenter();
              }
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  color: isDark ? '#94A3B8' : '#64748B',
                  font: { family: 'Inter', size: 11, weight: '500' },
                  boxWidth: 10,
                  boxHeight: 10,
                  borderRadius: 3,
                  useBorderRadius: true,
                  padding: 12
                }
              },
              tooltip: {
                backgroundColor: isDark ? 'rgba(17, 28, 58, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                titleColor: isDark ? '#F0F7FF' : '#0F172A',
                bodyColor: isDark ? '#93C5FD' : '#334155',
                borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(37, 99, 235, 0.15)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 10,
                boxPadding: 4,
                usePointStyle: true,
                callbacks: {
                  label: function(context) {
                    const val = context.parsed;
                    const pct = totalExp > 0 ? ((val / totalExp) * 100).toFixed(1) : 0;
                    return ` ${context.label}: ${formatRupiah(val)} (${pct}%)`;
                  }
                }
              }
            }
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

  if (btn7d) btn7d.className = period === '7d' ? 'active' : '';
  if (btn30d) btn30d.className = period === '30d' ? 'active' : '';
  if (btnMonthly) btnMonthly.className = period === 'monthly' ? 'active' : '';

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
  const canvas = document.getElementById('trendChart');
  const ctxTrend = canvas?.getContext('2d');
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
  const textColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';

  const labels = trendDataset.map(d => d.label || d.month);
  const incomeData = trendDataset.map(d => d.income);
  const expenseData = trendDataset.map(d => d.expense);

  // Update Net Badge in Card Header
  const totalInc = incomeData.reduce((a, b) => a + b, 0);
  const totalExp = expenseData.reduce((a, b) => a + b, 0);
  const net = totalInc - totalExp;
  const netBadge = document.getElementById('trendNetBadge');
  if (netBadge) {
    if (net >= 0) {
      netBadge.className = 'hidden sm:inline-block text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60 transition-all';
      netBadge.textContent = `+${formatRupiah(net)} (Surplus)`;
    } else {
      netBadge.className = 'hidden sm:inline-block text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 rounded-full border border-rose-200/60 dark:border-rose-800/60 transition-all';
      netBadge.textContent = `-${formatRupiah(Math.abs(net))} (Defisit)`;
    }
  }

  // Smooth Morphing: If chart already exists in the same theme, update data dynamically for a fluid liquid transition!
  if (trendChartInstance && trendChartInstance._isDark === isDark) {
    trendChartInstance.data.labels = labels;
    trendChartInstance.data.datasets[0].data = incomeData;
    trendChartInstance.data.datasets[1].data = expenseData;
    trendChartInstance.data.datasets[0].pointRadius = currentTrendPeriod === '30d' ? 2.5 : 5;
    trendChartInstance.data.datasets[1].pointRadius = currentTrendPeriod === '30d' ? 2.5 : 5;
    trendChartInstance.options.scales.x.ticks.font.size = currentTrendPeriod === '30d' ? 9 : 10;
    trendChartInstance.options.scales.x.ticks.maxRotation = currentTrendPeriod === '30d' ? 45 : 0;
    trendChartInstance.update();
    return;
  }

  if (trendChartInstance) {
    trendChartInstance.destroy();
  }

  // Linear Gradient Fill Generators for Wow AI Look
  const incomeColor = isDark ? '#34D399' : '#10B981';
  const expenseColor = isDark ? '#FB7185' : '#F43F5E';

  trendChartInstance = new Chart(ctxTrend, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Pemasukan',
          data: incomeData,
          borderColor: incomeColor,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return isDark ? 'rgba(52, 211, 153, 0.15)' : 'rgba(16, 185, 129, 0.1)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, isDark ? 'rgba(52, 211, 153, 0.40)' : 'rgba(16, 185, 129, 0.32)');
            gradient.addColorStop(0.65, isDark ? 'rgba(52, 211, 153, 0.10)' : 'rgba(16, 185, 129, 0.06)');
            gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
            return gradient;
          },
          tension: 0.42,
          fill: true,
          borderWidth: 3,
          pointStyle: 'circle',
          pointRadius: currentTrendPeriod === '30d' ? 2.5 : 5,
          pointBackgroundColor: isDark ? '#0B132B' : '#ffffff',
          pointBorderColor: incomeColor,
          pointBorderWidth: 2.5,
          pointHoverRadius: 8.5,
          pointHoverBorderWidth: 3.5,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: incomeColor,
          pointHitRadius: 25
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: expenseColor,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return isDark ? 'rgba(251, 113, 133, 0.12)' : 'rgba(244, 63, 94, 0.08)';
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, isDark ? 'rgba(251, 113, 133, 0.38)' : 'rgba(244, 63, 94, 0.30)');
            gradient.addColorStop(0.65, isDark ? 'rgba(251, 113, 133, 0.08)' : 'rgba(244, 63, 94, 0.05)');
            gradient.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
            return gradient;
          },
          tension: 0.42,
          fill: true,
          borderWidth: 3,
          pointStyle: 'circle',
          pointRadius: currentTrendPeriod === '30d' ? 2.5 : 5,
          pointBackgroundColor: isDark ? '#0B132B' : '#ffffff',
          pointBorderColor: expenseColor,
          pointBorderWidth: 2.5,
          pointHoverRadius: 8.5,
          pointHoverBorderWidth: 3.5,
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: expenseColor,
          pointHitRadius: 25
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1500,
        easing: 'easeOutQuart'
      },
      animations: {
        y: {
          duration: 1200,
          easing: 'easeOutCubic'
        }
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { family: 'Inter', size: 11, weight: '500' },
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: true,
            borderRadius: 3,
            padding: 14
          }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(17, 28, 58, 0.95)' : 'rgba(255, 255, 255, 0.96)',
          titleColor: isDark ? '#F0F7FF' : '#0F172A',
          bodyColor: isDark ? '#93C5FD' : '#334155',
          borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(37, 99, 235, 0.15)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 10,
          boxPadding: 4,
          usePointStyle: true,
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
            font: { family: 'Inter', size: currentTrendPeriod === '30d' ? 9 : 10 },
            maxRotation: currentTrendPeriod === '30d' ? 45 : 0
          }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'Inter', size: 10 },
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
  trendChartInstance._isDark = isDark;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
