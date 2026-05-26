// app.js
// Core dashboard logic, state management, file parsing, dynamic rendering, and automated business insights.

class SalesDashboard {
  constructor() {
    // State management
    this.rawData = [];
    this.filteredData = [];
    this.currentDatasetName = 'ecommerce'; // 'ecommerce' | 'saas' | 'custom'
    this.granularity = 'monthly'; // 'daily' | 'weekly' | 'monthly'
    this.pagination = { page: 1, limit: 10 };
    this.sorting = { column: '', direction: 'asc' };
    
    this.activeFilters = {
      search: '',
      category: 'ALL',
      region: 'ALL'
    };
    
    this.dateRange = {
      min: null,
      max: null,
      currentMin: null,
      currentMax: null
    };

    // Chart.js instances map to prevent duplicates/visual bugs on re-render
    this.charts = {};
    
    // For custom file mapping
    this.tempImportedData = null;
    this.columnMappings = {};
  }

  // Initialization lifecycle
  init() {
    console.log("Initializing Dashboard Core Application...");
    
    // Bind file upload events
    const fileInput = document.getElementById('file-uploader');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    }

    // Set initial preset dataset
    this.loadPresetDataset('ecommerce');
    
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Switch between built-in sample datasets
  switchDataset(name) {
    // Update sidebar navigation buttons
    document.querySelectorAll('.dataset-select-btn').forEach(btn => btn.classList.remove('active'));
    
    const activeBtn = document.getElementById(`btn-dataset-${name}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    this.loadPresetDataset(name);
  }

  // Load preset data from window.SAMPLE_DATASETS
  loadPresetDataset(name) {
    if (!window.SAMPLE_DATASETS || !window.SAMPLE_DATASETS[name]) {
      console.error(`Dataset '${name}' not found in sample-data.js`);
      return;
    }
    
    this.currentDatasetName = name;
    this.rawData = JSON.parse(JSON.stringify(window.SAMPLE_DATASETS[name]));
    
    // Update sidebar text metadata
    const sourceEl = document.getElementById('meta-source');
    const tagEl = document.getElementById('meta-dataset-tag');
    if (sourceEl) sourceEl.innerText = "Built-In Preset";
    if (tagEl) {
      tagEl.innerText = name === 'ecommerce' ? "TechStore E-commerce" : "SaaS Subscription Hub";
      tagEl.className = `table-badge ${name === 'ecommerce' ? 'blue' : 'green'}`;
    }

    // Set page subtitle based on dataset
    const subtitleEl = document.getElementById('dashboard-subtitle');
    if (subtitleEl) {
      subtitleEl.innerText = name === 'ecommerce' 
        ? "Monitor key retail trends, examine product profitability, and leverage interactive visual slicers for business strategy."
        : "Analyze recurring revenue growth (MRR/ARR), customer subscriptions, upgrade channels, cohort health, and churn rates.";
    }

    // Configure KPIs labels
    this.configureKPILabels();

    // Process dates and ranges
    this.extractDateRange();

    // Reset filters
    this.resetFilterState();

    // Render everything
    this.applyFilters();
  }

  // Set metric labels on cards based on active dataset
  configureKPILabels() {
    const kpi1Title = document.getElementById('kpi-1-title');
    const kpi2Title = document.getElementById('kpi-2-title');
    const kpi3Title = document.getElementById('kpi-3-title');
    const kpi4Title = document.getElementById('kpi-4-title');

    if (this.currentDatasetName === 'ecommerce') {
      if (kpi1Title) kpi1Title.innerText = "Total Revenue";
      if (kpi2Title) kpi2Title.innerText = "Volume Sold";
      if (kpi3Title) kpi3Title.innerText = "Avg Order Value";
      if (kpi4Title) kpi4Title.innerText = "Net Profit";
    } else if (this.currentDatasetName === 'saas') {
      if (kpi1Title) kpi1Title.innerText = "Monthly Rec. Rev (MRR)";
      if (kpi2Title) kpi2Title.innerText = "Active Subscribers";
      if (kpi3Title) kpi3Title.innerText = "Avg Rev Per User (ARPU)";
      if (kpi4Title) kpi4Title.innerText = "Annual Rec. Rev (ARR)";
    } else {
      // Custom mapping dataset titles
      if (kpi1Title) kpi1Title.innerText = "Mapped Revenue";
      if (kpi2Title) kpi2Title.innerText = "Mapped Quantity";
      if (kpi3Title) kpi3Title.innerText = "Avg Metric Value";
      if (kpi4Title) kpi4Title.innerText = "Net Mapped Value";
    }
  }

  // Extract absolute min/max dates from raw data
  extractDateRange() {
    if (this.rawData.length === 0) return;
    
    let dates = this.rawData.map(r => new Date(r.Date)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) {
      // Fallback
      dates = [new Date()];
    }
    
    this.dateRange.min = new Date(Math.min.apply(null, dates));
    this.dateRange.max = new Date(Math.max.apply(null, dates));
    
    this.dateRange.currentMin = new Date(this.dateRange.min);
    this.dateRange.currentMax = new Date(this.dateRange.max);
    
    // Set up range slider range
    const slider = document.getElementById('date-range-slider');
    if (slider) {
      slider.min = 0;
      slider.max = Math.ceil((this.dateRange.max - this.dateRange.min) / (1000 * 60 * 60 * 24));
      slider.value = slider.max; // Default is full range
    }
    
    this.updateDateRangeLabel();
  }

  // Update dates labels on UI
  updateDateRangeLabel() {
    const label = document.getElementById('date-slider-display');
    if (label && this.dateRange.currentMin && this.dateRange.currentMax) {
      const options = { year: 'numeric', month: 'short', day: '2-digit' };
      label.innerText = `${this.dateRange.currentMin.toLocaleDateString('en-US', options)} - ${this.dateRange.currentMax.toLocaleDateString('en-US', options)}`;
    }
  }

  // Handle slider adjustments
  handleDateSliderChange() {
    const slider = document.getElementById('date-range-slider');
    if (!slider) return;

    const daysOffset = parseInt(slider.value);
    
    // Create new currentMax date based on offset days from absolute min date
    const calculatedMax = new Date(this.dateRange.min.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    this.dateRange.currentMax = calculatedMax > this.dateRange.max ? new Date(this.dateRange.max) : calculatedMax;
    
    this.updateDateRangeLabel();
    this.applyFilters();
  }

  // Reset filter inputs and dropdown options
  resetFilterState() {
    this.activeFilters = { search: '', category: 'ALL', region: 'ALL' };
    
    const searchInp = document.getElementById('search-filter');
    if (searchInp) searchInp.value = '';

    // Populate Category Dropdown Slicer dynamically based on current data
    const catSelect = document.getElementById('category-filter');
    if (catSelect) {
      catSelect.innerHTML = '<option value="ALL">All Categories</option>';
      const uniqueCats = [...new Set(this.rawData.map(r => r.Category || r.Tier || r.Segment))].filter(Boolean);
      uniqueCats.sort().forEach(cat => {
        catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
      catSelect.value = 'ALL';
    }

    // Populate Region Dropdown Slicer dynamically
    const regSelect = document.getElementById('region-filter');
    if (regSelect) {
      regSelect.innerHTML = '<option value="ALL">All Regions</option>';
      const uniqueRegs = [...new Set(this.rawData.map(r => r.Region))].filter(Boolean);
      uniqueRegs.sort().forEach(reg => {
        regSelect.innerHTML += `<option value="${reg}">${reg}</option>`;
      });
      regSelect.value = 'ALL';
    }
    
    // Default sorting based on dataset type
    this.sorting = {
      column: this.currentDatasetName === 'ecommerce' ? 'Order ID' : 'Customer ID',
      direction: 'asc'
    };
  }

  // Filter application pipeline
  applyFilters() {
    // 1. Gather active inputs
    const searchVal = document.getElementById('search-filter')?.value.toLowerCase() || '';
    const categoryVal = document.getElementById('category-filter')?.value || 'ALL';
    const regionVal = document.getElementById('region-filter')?.value || 'ALL';

    this.activeFilters = { search: searchVal, category: categoryVal, region: regionVal };

    // 2. Perform Array Filter
    this.filteredData = this.rawData.filter(row => {
      // Date filter
      const rowDate = new Date(row.Date);
      if (rowDate < this.dateRange.currentMin || rowDate > this.dateRange.currentMax) {
        return false;
      }

      // Category filter
      const rowCat = row.Category || row.Tier || row.Segment;
      if (categoryVal !== 'ALL' && rowCat !== categoryVal) {
        return false;
      }

      // Region filter
      if (regionVal !== 'ALL' && row.Region !== regionVal) {
        return false;
      }

      // Search match
      if (searchVal) {
        const idVal = String(row['Order ID'] || row['Customer ID'] || '').toLowerCase();
        const prodVal = String(row.Product || row['Plan Name'] || '').toLowerCase();
        const catText = String(rowCat || '').toLowerCase();
        const regText = String(row.Region || '').toLowerCase();
        
        if (!idVal.includes(searchVal) && 
            !prodVal.includes(searchVal) && 
            !catText.includes(searchVal) && 
            !regText.includes(searchVal)) {
          return false;
        }
      }

      return true;
    });

    // Update metadata dashboard stats
    this.updateStatsMetadata();

    // 3. Compute Metrics and Render Visuals
    this.computeKPIs();
    this.renderCharts();
    this.generateInsights();
    
    // 4. Render Explorer Raw Table
    this.pagination.page = 1; // reset page on filter change
    this.renderTableExplorer();
  }

  // Update counts in sidebar info panel
  updateStatsMetadata() {
    const totalRowsEl = document.getElementById('meta-total-rows');
    const filteredRowsEl = document.getElementById('meta-filtered-rows');
    if (totalRowsEl) totalRowsEl.innerText = this.rawData.length.toLocaleString();
    if (filteredRowsEl) filteredRowsEl.innerText = this.filteredData.length.toLocaleString();
  }

  // Compute dashboard KPI totals
  computeKPIs() {
    if (this.filteredData.length === 0) {
      this.setKpiValues(0, 0, 0, 0, 0, 0, 0, 0);
      return;
    }

    // Determine current & previous date window halves for trend comparisons
    const activeSpanDays = (this.dateRange.currentMax - this.dateRange.currentMin) / (1000 * 60 * 60 * 24);
    const midPointDate = new Date(this.dateRange.currentMin.getTime() + (activeSpanDays / 2) * 24 * 60 * 60 * 1000);

    const firstHalfRows = [];
    const secondHalfRows = [];

    this.filteredData.forEach(r => {
      const d = new Date(r.Date);
      if (d < midPointDate) firstHalfRows.push(r);
      else secondHalfRows.push(r);
    });

    // Helper functions for aggregations
    const sum = (arr, key) => arr.reduce((acc, curr) => acc + (parseFloat(curr[key]) || 0), 0);
    const countUnique = (arr, key) => new Set(arr.map(r => r[key]).filter(Boolean)).size;

    let kpi1 = 0, kpi1Prev = 0;
    let kpi2 = 0, kpi2Prev = 0;
    let kpi3 = 0, kpi3Prev = 0;
    let kpi4 = 0, kpi4Prev = 0;

    if (this.currentDatasetName === 'ecommerce') {
      // E-commerce logic
      kpi1 = sum(this.filteredData, 'Revenue');
      kpi1Prev = sum(firstHalfRows, 'Revenue');

      kpi2 = sum(this.filteredData, 'Quantity');
      kpi2Prev = sum(firstHalfRows, 'Quantity');

      kpi3 = this.filteredData.length ? kpi1 / this.filteredData.length : 0;
      kpi3Prev = firstHalfRows.length ? kpi1Prev / firstHalfRows.length : 0;

      kpi4 = sum(this.filteredData, 'Profit');
      kpi4Prev = sum(firstHalfRows, 'Profit');
      
    } else if (this.currentDatasetName === 'saas') {
      // SaaS logic: MRR, Active Subscribers, ARPU, ARR
      // MRR is sum of Monthly Revenue for Status == Active or New. STATUS == Churned decreases it.
      kpi1 = sum(this.filteredData, 'Monthly Revenue');
      kpi1Prev = sum(firstHalfRows, 'Monthly Revenue');

      // Active customer counts
      const activeRows = this.filteredData.filter(r => r.Status === 'Active' || r.Status === 'New');
      const activeRowsPrev = firstHalfRows.filter(r => r.Status === 'Active' || r.Status === 'New');
      
      kpi2 = countUnique(activeRows, 'Customer ID');
      kpi2Prev = countUnique(activeRowsPrev, 'Customer ID');

      // ARPU = MRR / Active Subscribers
      kpi3 = kpi2 ? kpi1 / kpi2 : 0;
      kpi3Prev = kpi2Prev ? kpi1Prev / kpi2Prev : 0;

      // ARR = Monthly Recurring Revenue * 12
      kpi4 = kpi1 * 12;
      kpi4Prev = kpi1Prev * 12;
    } else {
      // Custom generic mappings
      kpi1 = sum(this.filteredData, 'Revenue');
      kpi1Prev = sum(firstHalfRows, 'Revenue');

      kpi2 = sum(this.filteredData, 'Quantity');
      kpi2Prev = sum(firstHalfRows, 'Quantity');

      kpi3 = this.filteredData.length ? kpi1 / this.filteredData.length : 0;
      kpi3Prev = firstHalfRows.length ? kpi1Prev / firstHalfRows.length : 0;

      kpi4 = sum(this.filteredData, 'Profit');
      kpi4Prev = sum(firstHalfRows, 'Profit');
    }

    // Set UI Values & Trends
    this.setKpiValues(kpi1, kpi1Prev, kpi2, kpi2Prev, kpi3, kpi3Prev, kpi4, kpi4Prev);

    // Render Sparklines
    this.renderKpiSparklines();
  }

  // Push values and percentages to KPI cards
  setKpiValues(kpi1, kpi1Prev, kpi2, kpi2Prev, kpi3, kpi3Prev, kpi4, kpi4Prev) {
    const isSaaS = this.currentDatasetName === 'saas';

    // Format helpers
    const formatCurrency = val => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
    const formatDecimalCurrency = val => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    const formatNum = val => new Intl.NumberFormat('en-US').format(Math.round(val));

    // Update Card Values
    document.getElementById('kpi-revenue-val').innerText = isSaaS ? formatDecimalCurrency(kpi1) : formatCurrency(kpi1);
    document.getElementById('kpi-volume-val').innerText = formatNum(kpi2);
    document.getElementById('kpi-aov-val').innerText = formatDecimalCurrency(kpi3);
    document.getElementById('kpi-profit-val').innerText = isSaaS ? formatCurrency(kpi4) : formatCurrency(kpi4);

    // Calculate percentage improvements
    const calcTrend = (curr, prev) => {
      if (prev === 0) return 0;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const t1 = calcTrend(kpi1, kpi1Prev);
    const t2 = calcTrend(kpi2, kpi2Prev);
    const t3 = calcTrend(kpi3, kpi3Prev);
    const t4 = calcTrend(kpi4, kpi4Prev);

    // Bind badges
    this.updateKpiBadge('kpi-revenue-badge', 'kpi-revenue-badge-txt', t1);
    this.updateKpiBadge('kpi-volume-badge', 'kpi-volume-badge-txt', t2);
    this.updateKpiBadge('kpi-aov-badge', 'kpi-aov-badge-txt', t3);
    this.updateKpiBadge('kpi-profit-badge', 'kpi-profit-badge-txt', t4);
  }

  // Update trend indicators dynamically
  updateKpiBadge(badgeId, textId, trendVal) {
    const badge = document.getElementById(badgeId);
    const text = document.getElementById(textId);
    if (!badge || !text) return;

    const formattedTrend = `${trendVal >= 0 ? '+' : ''}${trendVal.toFixed(1)}%`;
    text.innerText = formattedTrend;

    if (trendVal >= 0) {
      badge.className = "kpi-badge up";
      badge.querySelector('i')?.setAttribute('data-lucide', 'trending-up');
    } else {
      badge.className = "kpi-badge down";
      badge.querySelector('i')?.setAttribute('data-lucide', 'trending-down');
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Draw miniature sparklines inside KPI cards
  renderKpiSparklines() {
    // Determine sparkline timeline buckets (aggregate last 15 periods to display a sparkline)
    const timelineData = this.aggregateTimelineData(15);
    if (timelineData.labels.length === 0) return;

    const sparklines = [
      { canvasId: 'sparkline-revenue', dataKey: 'revenue', color: '#6366f1' },
      { canvasId: 'sparkline-volume', dataKey: 'quantity', color: '#8b5cf6' },
      { canvasId: 'sparkline-aov', dataKey: 'aov', color: '#10b981' },
      { canvasId: 'sparkline-profit', dataKey: 'profit', color: '#f59e0b' }
    ];

    sparklines.forEach(conf => {
      const ctx = document.getElementById(conf.canvasId)?.getContext('2d');
      if (!ctx) return;

      // Clean old instance
      if (this.charts[conf.canvasId]) {
        this.charts[conf.canvasId].destroy();
      }

      // Custom smooth gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, 40);
      gradient.addColorStop(0, conf.color + '33');
      gradient.addColorStop(1, conf.color + '00');

      const chartData = timelineData.points.map(pt => {
        if (conf.dataKey === 'aov') {
          return pt.quantity ? pt.revenue / pt.quantity : 0;
        }
        return pt[conf.dataKey];
      });

      this.charts[conf.canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timelineData.labels,
          datasets: [{
            data: chartData,
            borderColor: conf.color,
            borderWidth: 1.5,
            fill: true,
            backgroundColor: gradient,
            tension: 0.45,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
    });
  }

  // Timeline aggregations utility
  aggregateTimelineData(maxBuckets = 15) {
    if (this.filteredData.length === 0) return { labels: [], points: [] };

    // Group items by date string
    const groups = {};
    this.filteredData.forEach(row => {
      const dStr = row.Date; // YYYY-MM-DD
      if (!groups[dStr]) {
        groups[dStr] = { revenue: 0, quantity: 0, profit: 0 };
      }
      groups[dStr].revenue += parseFloat(row.Revenue || row['Monthly Revenue'] || 0);
      groups[dStr].quantity += parseFloat(row.Quantity || (row.Status !== 'Churned' ? 1 : 0) || 0);
      groups[dStr].profit += parseFloat(row.Profit || row['Annual Contract Value'] || 0);
    });

    const sortedDates = Object.keys(groups).sort((a, b) => new Date(a) - new Date(b));
    
    // Bin dates evenly into maxBuckets to make readable sparklines
    let labels = [];
    let points = [];
    
    if (sortedDates.length <= maxBuckets) {
      sortedDates.forEach(date => {
        labels.push(date);
        points.push(groups[date]);
      });
    } else {
      const groupSize = Math.ceil(sortedDates.length / maxBuckets);
      for (let i = 0; i < sortedDates.length; i += groupSize) {
        const slice = sortedDates.slice(i, i + groupSize);
        let revSum = 0, qtySum = 0, profSum = 0;
        slice.forEach(d => {
          revSum += groups[d].revenue;
          qtySum += groups[d].quantity;
          profSum += groups[d].profit;
        });
        labels.push(slice[slice.length - 1]);
        points.push({ revenue: revSum, quantity: qtySum, profit: profSum });
      }
    }

    return { labels, points };
  }

  // Handle line chart granularity change
  setGranularity(mode) {
    this.granularity = mode;
    document.querySelectorAll('.granularity-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`granularity-${mode}`).classList.add('active');
    
    this.renderTrendChart();
  }

  // Main visual charts router
  renderCharts() {
    this.renderTrendChart();
    this.renderTopProductsChart();
    this.renderCategoryBreakdownChart();
    this.renderRegionalSplitChart();
  }

  // Render Time-Series line/area trend chart
  renderTrendChart() {
    const ctx = document.getElementById('chart-sales-trend')?.getContext('2d');
    if (!ctx) return;

    if (this.charts['trend']) {
      this.charts['trend'].destroy();
    }

    // Bucketing data depending on daily/weekly/monthly granularity
    const aggregated = {};
    
    this.filteredData.forEach(row => {
      const d = new Date(row.Date);
      let bucketKey = "";
      
      if (this.granularity === 'daily') {
        bucketKey = row.Date;
      } else if (this.granularity === 'weekly') {
        // Find beginning of week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
        const startOfWeek = new Date(d.setDate(diff));
        bucketKey = startOfWeek.toISOString().split('T')[0];
      } else {
        // Monthly
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        bucketKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }

      if (!aggregated[bucketKey]) {
        aggregated[bucketKey] = { revenue: 0, profit: 0 };
      }
      aggregated[bucketKey].revenue += parseFloat(row.Revenue || row['Monthly Revenue'] || 0);
      aggregated[bucketKey].profit += parseFloat(row.Profit || (row['Monthly Revenue'] * 0.3) || 0); // fallback profit if missing
    });

    // Sort buckets chronologically
    let sortedKeys = Object.keys(aggregated);
    if (this.granularity !== 'monthly') {
      sortedKeys.sort((a, b) => new Date(a) - new Date(b));
    } else {
      // Sort monthly key names properly
      const getMonthIndex = key => {
        const parts = key.split(' ');
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return parseInt(parts[1]) * 12 + months.indexOf(parts[0]);
      };
      sortedKeys.sort((a, b) => getMonthIndex(a) - getMonthIndex(b));
    }

    const labels = sortedKeys;
    const revenues = sortedKeys.map(k => parseFloat(aggregated[k].revenue.toFixed(2)));
    const profits = sortedKeys.map(k => parseFloat(aggregated[k].profit.toFixed(2)));

    // Neon Gradients
    const revGradient = ctx.createLinearGradient(0, 0, 0, 250);
    revGradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    revGradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

    const profGradient = ctx.createLinearGradient(0, 0, 0, 250);
    profGradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    profGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');

    this.charts['trend'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: this.currentDatasetName === 'saas' ? 'Active MRR' : 'Sales Revenue',
            data: revenues,
            borderColor: '#6366f1',
            borderWidth: 2,
            backgroundColor: revGradient,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#6366f1',
            pointRadius: labels.length > 50 ? 0 : 3
          },
          {
            label: this.currentDatasetName === 'saas' ? 'Estimated Profit (30% Margin)' : 'Net Profit',
            data: profits,
            borderColor: '#10b981',
            borderWidth: 1.5,
            backgroundColor: profGradient,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#10b981',
            pointRadius: labels.length > 50 ? 0 : 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { family: 'Inter', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.04)' },
            ticks: { 
              color: '#64748b', 
              font: { family: 'Inter', size: 10 },
              callback: val => '$' + new Intl.NumberFormat('en').format(val)
            }
          }
        }
      }
    });
  }

  // Top products horizontal bars
  renderTopProductsChart() {
    const ctx = document.getElementById('chart-top-products')?.getContext('2d');
    if (!ctx) return;

    if (this.charts['products']) {
      this.charts['products'].destroy();
    }

    // Sum revenue by Product/Plan Name
    const productKey = this.currentDatasetName === 'ecommerce' ? 'Product' : 'Plan Name';
    
    const prodTotals = {};
    this.filteredData.forEach(row => {
      const pName = row[productKey] || "Unknown Item";
      const rev = parseFloat(row.Revenue || row['Monthly Revenue'] || 0);
      prodTotals[pName] = (prodTotals[pName] || 0) + rev;
    });

    // Sort descending and slice top 7
    const sortedProds = Object.keys(prodTotals)
      .map(k => ({ name: k, total: prodTotals[k] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);

    const labels = sortedProds.map(p => p.name);
    const dataVals = sortedProds.map(p => parseFloat(p.total.toFixed(2)));

    this.charts['products'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue',
          data: dataVals,
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          borderWidth: 0,
          barThickness: 16
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#f8fafc',
            bodyColor: '#94a3b8'
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { 
              color: '#64748b', 
              font: { size: 9 },
              callback: val => '$' + new Intl.NumberFormat('en').format(val)
            }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#f8fafc', font: { size: 10, weight: '500' } }
          }
        }
      }
    });
  }

  // Category split pie/doughnut
  renderCategoryBreakdownChart() {
    const ctx = document.getElementById('chart-category-breakdown')?.getContext('2d');
    if (!ctx) return;

    if (this.charts['category']) {
      this.charts['category'].destroy();
    }

    const catKey = this.currentDatasetName === 'ecommerce' ? 'Category' : (this.currentDatasetName === 'saas' ? 'Tier' : 'Category');
    
    const catTotals = {};
    this.filteredData.forEach(row => {
      const cat = row[catKey] || "Other";
      const rev = parseFloat(row.Revenue || row['Monthly Revenue'] || 0);
      catTotals[cat] = (catTotals[cat] || 0) + rev;
    });

    const labels = Object.keys(catTotals);
    const dataVals = labels.map(c => parseFloat(catTotals[c].toFixed(2)));

    // Harmonized palette
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

    this.charts['category'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataVals,
          backgroundColor: colors.slice(0, labels.length),
          borderColor: '#111827',
          borderWidth: 2,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { size: 11 } }
          },
          tooltip: {
            backgroundColor: '#1e293b',
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percent = ((value / total) * 100).toFixed(1);
                return ` ${label}: $${new Intl.NumberFormat('en').format(value)} (${percent}%)`;
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }

  // Region splits radar/bar chart
  renderRegionalSplitChart() {
    const ctx = document.getElementById('chart-regional-split')?.getContext('2d');
    if (!ctx) return;

    if (this.charts['region']) {
      this.charts['region'].destroy();
    }

    // Determine aggregate values
    const regTotals = {};
    this.filteredData.forEach(row => {
      const reg = row.Region || "Global";
      const rev = parseFloat(row.Revenue || row['Monthly Revenue'] || 0);
      regTotals[reg] = (regTotals[reg] || 0) + rev;
    });

    const labels = Object.keys(regTotals);
    const dataVals = labels.map(r => parseFloat(regTotals[r].toFixed(2)));

    this.charts['region'] = new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: labels,
        datasets: [{
          label: 'Revenue by Region',
          data: dataVals,
          backgroundColor: [
            'rgba(99, 102, 241, 0.4)',
            'rgba(16, 185, 129, 0.4)',
            'rgba(245, 158, 11, 0.4)',
            'rgba(139, 92, 246, 0.4)'
          ],
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1.5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { size: 10 } }
          }
        },
        scales: {
          r: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { display: false },
            angleLines: { color: 'rgba(255, 255, 255, 0.05)' }
          }
        }
      }
    });
  }

  // Automatically generate detailed insights on the active data subsets
  generateInsights() {
    const list = document.getElementById('insights-list-container');
    if (!list) return;

    if (this.filteredData.length === 0) {
      list.innerHTML = `<li class="insights-item neutral">
        <i data-lucide="help-circle" class="insights-item-icon" style="width: 16px; height: 16px; color: var(--accent-amber);"></i>
        <div>No data matches your current filter combination to compute insights.</div>
      </li>`;
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }

    const insights = [];

    // Helper functions
    const sum = (arr, key) => arr.reduce((acc, curr) => acc + (parseFloat(curr[key]) || 0), 0);
    const totalRev = sum(this.filteredData, this.currentDatasetName === 'saas' ? 'Monthly Revenue' : 'Revenue');

    // 1. Growth Trends Analysis
    const activeSpanDays = (this.dateRange.currentMax - this.dateRange.currentMin) / (1000 * 60 * 60 * 24);
    const midPointDate = new Date(this.dateRange.currentMin.getTime() + (activeSpanDays / 2) * 24 * 60 * 60 * 1000);
    
    const h1 = this.filteredData.filter(r => new Date(r.Date) < midPointDate);
    const h2 = this.filteredData.filter(r => new Date(r.Date) >= midPointDate);
    const revKey = this.currentDatasetName === 'saas' ? 'Monthly Revenue' : 'Revenue';
    
    const h1Rev = sum(h1, revKey);
    const h2Rev = sum(h2, revKey);
    
    if (h1Rev > 0) {
      const growth = ((h2Rev - h1Rev) / h1Rev) * 100;
      if (growth > 3) {
        insights.push({
          type: 'growth',
          icon: 'trending-up',
          color: 'var(--accent-emerald)',
          text: `Positive momentum! Total Revenue increased by <strong>${growth.toFixed(1)}%</strong> in the second half of the selected date range compared to the first half ($${new Intl.NumberFormat('en').format(Math.round(h2Rev))} vs $${new Intl.NumberFormat('en').format(Math.round(h1Rev))}).`
        });
      } else if (growth < -3) {
        insights.push({
          type: 'alert',
          icon: 'trending-down',
          color: 'var(--accent-crimson)',
          text: `Sales contraction warning! Revenue declined by <strong>${Math.abs(growth).toFixed(1)}%</strong> in the latter half of the filtered timeframe.`
        });
      } else {
        insights.push({
          type: 'neutral',
          icon: 'minus-circle',
          color: 'var(--accent-amber)',
          text: `Revenue remained highly stable, hovering within a minimal <strong>${growth.toFixed(1)}%</strong> fluctuation range throughout the selected period.`
        });
      }
    }

    // 2. Top Selling product focus
    const prodKey = this.currentDatasetName === 'ecommerce' ? 'Product' : 'Plan Name';
    const prodMap = {};
    this.filteredData.forEach(r => {
      const p = r[prodKey];
      prodMap[p] = (prodMap[p] || 0) + parseFloat(r[revKey] || 0);
    });

    const topProduct = Object.keys(prodMap)
      .map(k => ({ name: k, rev: prodMap[k] }))
      .sort((a, b) => b.rev - a.rev)[0];

    if (topProduct && totalRev > 0) {
      const share = (topProduct.rev / totalRev) * 100;
      insights.push({
        type: 'growth',
        icon: 'star',
        color: 'var(--accent-emerald)',
        text: `Top performer: <strong>${topProduct.name}</strong> is your primary driver, generating <strong>$${new Intl.NumberFormat('en').format(Math.round(topProduct.rev))}</strong> which represents <strong>${share.toFixed(1)}%</strong> of all revenue.`
      });
    }

    // 3. Regional contribution focus
    const regMap = {};
    this.filteredData.forEach(r => {
      const rg = r.Region || "Unknown";
      regMap[rg] = (regMap[rg] || 0) + parseFloat(r[revKey] || 0);
    });

    const topRegion = Object.keys(regMap)
      .map(k => ({ name: k, rev: regMap[k] }))
      .sort((a, b) => b.rev - a.rev)[0];

    if (topRegion && totalRev > 0) {
      const regShare = (topRegion.rev / totalRev) * 100;
      insights.push({
        type: 'neutral',
        icon: 'globe',
        color: 'var(--accent-indigo)',
        text: `Regional Dominance: <strong>${topRegion.name}</strong> is your strongest territory, contributing <strong>${regShare.toFixed(1)}%</strong> of your global revenue slice.`
      });
    }

    // 4. Dataset-specific special insights
    if (this.currentDatasetName === 'saas') {
      const churnedCount = this.filteredData.filter(r => r.Status === 'Churned').length;
      const totalCount = this.filteredData.length;
      const churnRate = totalCount ? (churnedCount / totalCount) * 100 : 0;
      
      if (churnRate > 5) {
        insights.push({
          type: 'alert',
          icon: 'alert-triangle',
          color: 'var(--accent-crimson)',
          text: `Churn warning! High cohort cancellations identified. Churn rate reached <strong>${churnRate.toFixed(1)}%</strong> of transactions. Recommend review of pricing structures or subscriber outreach.`
        });
      } else {
        insights.push({
          type: 'growth',
          icon: 'check-circle',
          color: 'var(--accent-emerald)',
          text: `Healthy retention! Subscriber churn rate is highly controlled at a low <strong>${churnRate.toFixed(1)}%</strong>, indicating high customer lifetime values (LTV).`
        });
      }
    } else if (this.currentDatasetName === 'ecommerce') {
      // E-commerce profit margins
      const totalProfit = sum(this.filteredData, 'Profit');
      const profitMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;
      
      insights.push({
        type: 'growth',
        icon: 'percent',
        color: 'var(--accent-emerald)',
        text: `Your average Gross Profit Margin sits at <strong>${profitMargin.toFixed(1)}%</strong>. This indicates efficient operational spending and excellent unit economics.`
      });
    }

    // 5. Smart Forecast Projection
    // Average monthly revenue in selected timeline projected 3 months ahead
    const monthSet = new Set(this.filteredData.map(r => r.Date.substring(0, 7)));
    const activeMonths = monthSet.size || 1;
    const avgMonthlyRev = totalRev / activeMonths;
    const projectedQSales = avgMonthlyRev * 3;

    insights.push({
      type: 'neutral',
      icon: 'calculator',
      color: 'var(--accent-amber)',
      text: `Quarterly Forecast: Operating on a run-rate of $${new Intl.NumberFormat('en').format(Math.round(avgMonthlyRev))}/month, projected sales for the next quarter (Q+1) are estimated at <strong>$${new Intl.NumberFormat('en').format(Math.round(projectedQSales))}</strong> (assuming seasonal trends remain consistent).`
    });

    // Populate list items into DOM
    list.innerHTML = "";
    insights.forEach(ins => {
      list.innerHTML += `<li class="insights-item ${ins.type}">
        <i data-lucide="${ins.icon}" class="insights-item-icon" style="width: 16px; height: 16px; color: ${ins.color};"></i>
        <div>${ins.text}</div>
      </li>`;
    });

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Render Explorer Table
  renderTableExplorer() {
    const tableHeaderRow = document.getElementById('table-header-row-target');
    const tableBody = document.getElementById('table-body-target');
    if (!tableHeaderRow || !tableBody) return;

    if (this.filteredData.length === 0) {
      tableHeaderRow.innerHTML = '<th>No Data Found</th>';
      tableBody.innerHTML = `<tr><td style="text-align: center; padding: 2rem;">No matching transaction records discovered. Adjust filters.</td></tr>`;
      
      // Update pagination displays
      document.getElementById('pagination-display').innerText = "Showing 0-0 of 0 transactions";
      document.getElementById('btn-pagination-prev').disabled = true;
      document.getElementById('btn-pagination-next').disabled = true;
      return;
    }

    // Determine headers depending on current active dataset
    let headers = [];
    if (this.currentDatasetName === 'ecommerce') {
      headers = ["Order ID", "Date", "Product", "Category", "Quantity", "Unit Price", "Revenue", "Region", "Profit"];
    } else if (this.currentDatasetName === 'saas') {
      headers = ["Customer ID", "Date", "Tier", "Plan Name", "Segment", "Billing Interval", "Monthly Revenue", "Region", "Status"];
    } else {
      // Dynamic fallback headers based on custom map
      headers = Object.keys(this.filteredData[0]);
    }

    // 1. Render Table Headings with sort handlers
    tableHeaderRow.innerHTML = "";
    headers.forEach(h => {
      const isSortedCol = this.sorting.column === h;
      const indicatorSymbol = isSortedCol ? (this.sorting.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕';
      
      tableHeaderRow.innerHTML += `<th onclick="app.handleSort('${h}')">
        ${h} <span class="sort-indicator">${indicatorSymbol}</span>
      </th>`;
    });

    // 2. Perform sorting
    const col = this.sorting.column;
    const dirMultiplier = this.sorting.direction === 'asc' ? 1 : -1;

    this.filteredData.sort((a, b) => {
      let aVal = a[col];
      let bVal = b[col];

      // Parse numerical values if numeric column
      if (col === 'Revenue' || col === 'Profit' || col === 'Quantity' || col === 'Unit Price' || col === 'Monthly Revenue' || col === 'Annual Contract Value') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      } else if (col === 'Date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
      }

      if (aVal < bVal) return -1 * dirMultiplier;
      if (aVal > bVal) return 1 * dirMultiplier;
      return 0;
    });

    // 3. Perform pagination
    const totalCount = this.filteredData.length;
    const pageLimit = this.pagination.limit;
    const totalPages = Math.ceil(totalCount / pageLimit);
    const currentPage = Math.min(this.pagination.page, totalPages);
    this.pagination.page = currentPage || 1;

    const startIndex = (this.pagination.page - 1) * pageLimit;
    const endIndex = Math.min(startIndex + pageLimit, totalCount);

    const paginatedSlice = this.filteredData.slice(startIndex, endIndex);

    // 4. Render Rows
    tableBody.innerHTML = "";
    paginatedSlice.forEach(row => {
      let rowHtml = "<tr>";
      headers.forEach(h => {
        const val = row[h];
        let displayVal = val;

        // Custom cell formats
        if (h === 'Revenue' || h === 'Profit' || h === 'Monthly Revenue' || h === 'Unit Price') {
          displayVal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(val) || 0);
        }

        // Custom Badge wrappers
        if (h === 'Status') {
          const badgeClass = val === 'Active' || val === 'New' ? 'green' : (val === 'Churned' ? 'red' : 'blue');
          displayVal = `<span class="table-badge ${badgeClass}">${val}</span>`;
        } else if (h === 'Category' || h === 'Tier') {
          displayVal = `<span class="table-badge blue">${val}</span>`;
        }

        rowHtml += `<td>${displayVal !== undefined ? displayVal : ''}</td>`;
      });
      rowHtml += "</tr>";
      tableBody.innerHTML += rowHtml;
    });

    // 5. Update pagination UI controls
    document.getElementById('pagination-display').innerText = `Showing ${totalCount ? startIndex + 1 : 0}-${endIndex} of ${totalCount} transactions`;
    document.getElementById('btn-pagination-prev').disabled = this.pagination.page === 1;
    document.getElementById('btn-pagination-next').disabled = this.pagination.page === totalPages || totalPages === 0;
  }

  // Handle pagination pages
  changePage(dir) {
    this.pagination.page += dir;
    this.renderTableExplorer();
  }

  // Handle table header sorting clicks
  handleSort(columnName) {
    if (this.sorting.column === columnName) {
      // Toggle direction
      this.sorting.direction = this.sorting.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sorting.column = columnName;
      this.sorting.direction = 'asc';
    }
    this.renderTableExplorer();
  }

  // EXPORT raw data currently loaded back to client as CSV
  exportFilteredData() {
    if (this.filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }

    let headers = Object.keys(this.filteredData[0]);
    let csvRows = [headers.join(",")];

    this.filteredData.forEach(row => {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = String(val === undefined ? '' : val).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dashboard_export_${this.currentDatasetName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // FILE UPLOAD AND CUSTOM SCHEMA PARSING
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log("Uploaded file detected:", file.name, file.size, "bytes");

    const reader = new FileReader();
    
    // Check if CSV or Excel
    const ext = file.name.split('.').pop().toLowerCase();
    
    reader.onload = (e) => {
      try {
        let jsonData = [];
        
        if (ext === 'csv') {
          // Parse CSV
          const text = e.target.result;
          jsonData = this.parseCSVText(text);
        } else {
          // Parse Excel using SheetJS
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        }

        if (jsonData.length === 0) {
          alert("We couldn't read any records from this file. Ensure the sheet isn't empty!");
          return;
        }

        console.log("Parsed rows count from upload:", jsonData.length);
        this.processUploadedJSON(jsonData);
      } catch (err) {
        console.error("Excel/CSV import error: ", err);
        alert(`An error occurred while reading the file: ${err.message}`);
      }
    };

    if (ext === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  }

  // Fallback lightweight parser for raw CSV
  parseCSVText(text) {
    const lines = text.split(/\r\n|\n/);
    if (lines.length === 0) return [];
    
    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = this.parseCSVLine(lines[i]);
      
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] !== undefined ? values[idx] : "";
      });
      results.push(row);
    }
    return results;
  }

  parseCSVLine(line) {
    const result = [];
    let insideQuote = false;
    let entry = "";
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry.trim());
    return result;
  }

  // Column mapper and data ingestion pipeline
  processUploadedJSON(jsonData) {
    this.tempImportedData = jsonData;
    const firstRow = jsonData[0];
    const columns = Object.keys(firstRow);

    // Auto-detect standard columns
    const mappings = {
      Date: this.detectColumnByKeywords(columns, ["date", "time", "day", "period", "timestamp"]),
      Revenue: this.detectColumnByKeywords(columns, ["rev", "sale", "amount", "value", "mrr", "income", "price"]),
      Product: this.detectColumnByKeywords(columns, ["prod", "item", "description", "name"]),
      Category: this.detectColumnByKeywords(columns, ["cat", "tier", "class", "group"]),
      Region: this.detectColumnByKeywords(columns, ["region", "area", "country", "city", "market", "zone"]),
      Quantity: this.detectColumnByKeywords(columns, ["qty", "quantity", "count", "num"])
    };

    console.log("Auto-detected mapping candidates:", mappings);

    // If we auto-detected most essential columns (Date and Revenue are crucial!), do instant import.
    // Otherwise open mapping modal dialog.
    if (mappings.Date && mappings.Revenue && mappings.Product) {
      // Fast import
      this.columnMappings = mappings;
      this.executeMappedImport();
    } else {
      // Open mapping dialog modal to ask user to map columns
      this.openMappingModal(columns, mappings);
    }
  }

  detectColumnByKeywords(columns, keywords) {
    for (let i = 0; i < columns.length; i++) {
      const colLow = columns[i].toLowerCase();
      if (keywords.some(k => colLow.includes(k))) {
        return columns[i];
      }
    }
    return ""; // not found
  }

  // Modal actions
  openMappingModal(columns, currentMappings) {
    const modal = document.getElementById('mapping-modal');
    const container = document.getElementById('modal-mapping-list-target');
    if (!modal || !container) return;

    container.innerHTML = "";
    
    // Core columns that we need to bind
    const coreProperties = [
      { key: 'Date', desc: 'Date of transaction', icon: 'calendar', required: true },
      { key: 'Revenue', desc: 'Revenue value ($)', icon: 'dollar-sign', required: true },
      { key: 'Product', desc: 'Product name or service', icon: 'package', required: true },
      { key: 'Category', desc: 'Category / Group', icon: 'tag', required: false },
      { key: 'Region', desc: 'Sales Territory / Region', icon: 'globe', required: false },
      { key: 'Quantity', desc: 'Volume sold / count', icon: 'shopping-cart', required: false }
    ];

    coreProperties.forEach(prop => {
      // Build dropdown choices
      let selectOptions = `<option value="">-- Ignore / None --</option>`;
      columns.forEach(col => {
        const isSelected = currentMappings[prop.key] === col ? 'selected' : '';
        selectOptions += `<option value="${col}" ${isSelected}>${col}</option>`;
      });

      container.innerHTML += `
        <div class="mapping-row">
          <div class="mapping-label">
            <i data-lucide="${prop.icon}" style="width:16px; height:16px;"></i>
            <strong>${prop.key}</strong>
            ${prop.required ? '<span style="color:var(--accent-crimson);">*</span>' : ''}
          </div>
          <select id="modal-select-${prop.key}" class="form-select">
            ${selectOptions}
          </select>
        </div>
      `;
    });

    modal.classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  closeMappingModal() {
    const modal = document.getElementById('mapping-modal');
    if (modal) modal.classList.remove('open');
    this.tempImportedData = null;
  }

  executeMappedImport() {
    // Gather selections if modal is open, or use parsed columnMappings
    const modalIsOpen = document.getElementById('mapping-modal')?.classList.contains('open');
    
    if (modalIsOpen) {
      this.columnMappings = {
        Date: document.getElementById('modal-select-Date')?.value,
        Revenue: document.getElementById('modal-select-Revenue')?.value,
        Product: document.getElementById('modal-select-Product')?.value,
        Category: document.getElementById('modal-select-Category')?.value,
        Region: document.getElementById('modal-select-Region')?.value,
        Quantity: document.getElementById('modal-select-Quantity')?.value
      };
    }

    // Validate requirements (Date & Revenue & Product required)
    if (!this.columnMappings.Date || !this.columnMappings.Revenue || !this.columnMappings.Product) {
      alert("Mapping Failure: You must map 'Date', 'Revenue', and 'Product' columns to import your dataset.");
      return;
    }

    try {
      const mappedRows = [];
      let orderIdIdx = 10001;

      this.tempImportedData.forEach(row => {
        // Build unified schema structure row
        const revenue = parseFloat(String(row[this.columnMappings.Revenue]).replace(/[$,]/g, '')) || 0;
        const quantity = parseFloat(row[this.columnMappings.Quantity]) || 1;
        const category = row[this.columnMappings.Category] || "Other / Mapped";
        const region = row[this.columnMappings.Region] || "Global / Online";
        const dateRaw = row[this.columnMappings.Date];
        
        let dateStr = "";
        
        // Parse date properly (handle sheetJS date serial numbers if any)
        if (typeof dateRaw === 'number') {
          // Serial Excel date offset
          const dateObj = XLSX.SSF.parse_date_code(dateRaw);
          dateStr = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
        } else {
          // Standard text parse
          const d = new Date(dateRaw);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          } else {
            // fallback today
            dateStr = new Date().toISOString().split('T')[0];
          }
        }

        mappedRows.push({
          "Order ID": `CUST-${orderIdIdx++}`,
          "Date": dateStr,
          "Product": row[this.columnMappings.Product] || "Unnamed Item",
          "Category": category,
          "Quantity": quantity,
          "Unit Price": parseFloat((revenue / quantity).toFixed(2)) || 0,
          "Revenue": revenue,
          "Region": region,
          "Profit": parseFloat((revenue * 0.35).toFixed(2)) // Default estimated profit 35% margin
        });
      });

      // Load mapped row arrays into dashboard state
      this.rawData = mappedRows;
      this.currentDatasetName = 'custom';

      // Update UI Header Subtitle to reflect loaded file
      const subtitle = document.getElementById('dashboard-subtitle');
      if (subtitle) {
        subtitle.innerHTML = `Analyzing custom imported spreadsheet dataset. Standard schema mapped successfully. Ready for exploration.`;
      }

      // Update sidebar text metadata
      const sourceEl = document.getElementById('meta-source');
      const tagEl = document.getElementById('meta-dataset-tag');
      if (sourceEl) sourceEl.innerText = "Custom File Upload";
      if (tagEl) {
        tagEl.innerText = "Custom Sheet Import";
        tagEl.className = "table-badge amber";
      }

      // Configure KPI Labels
      this.configureKPILabels();

      // Extract ranges & Reset inputs
      this.extractDateRange();
      this.resetFilterState();
      
      // Render
      this.applyFilters();
      
      // Close modal
      this.closeMappingModal();

      // Clear files
      document.getElementById('file-uploader').value = "";

      // Micro-confetti success trigger!
      if (typeof confetti !== 'undefined') {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      
    } catch (err) {
      console.error(err);
      alert(`Import Processing Error: Failed to structure row parsing. Details: ${err.message}`);
    }
  }
}

// Instantiate dashboard on page load
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new SalesDashboard();
  app.init();
});
