/**
 * VRES.life – VA Multi-Unit Property Search
 * Main application controller
 */

const App = (() => {

  /* -------- state -------- */
  let state = {
    properties: [],
    totalResults: 0,
    isDemo: true,
    loading: false,
    page: 1,
    sort: 'newest',
    sortKey: null,
    sortDir: 'asc',
    params: {},
  };

  /* -------- init -------- */
  function init() {
    Table.init('results-table', handleTableSort);
    bindSearch();
    bindCalculator();
    bindAPIConfig();
    updateCalcDisplay();
    doSearch({ demo: true });  // load demo results on startup
  }

  /* -------- search -------- */
  function bindSearch() {
    document.getElementById('search-btn').addEventListener('click', () => doSearch());
    document.getElementById('search-clear').addEventListener('click', clearSearch);
    document.getElementById('location-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch();
    });
    document.getElementById('sort-select').addEventListener('change', e => {
      state.sort = e.target.value;
      doSearch({ keepPage: false });
    });
    document.getElementById('export-btn').addEventListener('click', () => {
      Table.exportCSV(state.properties);
      toast('CSV exported successfully!', 'success');
    });
  }

  function clearSearch() {
    document.getElementById('location-input').value = '';
    document.getElementById('unit-type').value = 'all';
    document.getElementById('min-price').value = '';
    document.getElementById('max-price').value = '';
    document.getElementById('min-beds').value = '';
    state.page = 1;
    doSearch({ demo: true });
  }

  async function doSearch({ keepPage = false, demo = false } = {}) {
    if (!keepPage) state.page = 1;

    const params = {
      location: document.getElementById('location-input').value.trim() || 'Texas',
      unitType: document.getElementById('unit-type').value,
      minPrice: parsePrice(document.getElementById('min-price').value),
      maxPrice: parsePrice(document.getElementById('max-price').value),
      minBeds:  parseInt(document.getElementById('min-beds').value) || 0,
      sort:     state.sort,
      page:     state.page,
      apiKey:   getApiKey(),
    };

    state.params = params;
    state.loading = true;
    setLoadingState(true);

    try {
      const result = await PropertyAPI.search(params);
      state.properties  = result.properties;
      state.totalResults = result.total;
      state.isDemo       = result.demo;

      // Apply client-side sort if active
      if (state.sortKey) {
        state.properties = Table.sortProperties(state.properties, state.sortKey, state.sortDir);
      }

      renderResults();
      updateDemoBanner(result.demo);

      if (result.error) {
        toast('API error – showing demo data. Check your API key.', 'error');
      }
    } catch (err) {
      toast('Search failed: ' + err.message, 'error');
    } finally {
      state.loading = false;
      setLoadingState(false);
    }
  }

  function handleTableSort(key, dir) {
    state.sortKey = key;
    state.sortDir = dir;
    state.properties = Table.sortProperties(state.properties, key, dir);
    const start = (state.page - 1) * 20 + 1;
    Table.render('results-tbody', state.properties, start);
  }

  /* -------- render -------- */
  function renderResults() {
    const { properties, totalResults, page } = state;
    const perPage = 20;
    const pageProps = properties.slice((page - 1) * perPage, page * perPage);
    const start = (page - 1) * perPage + 1;

    document.getElementById('result-count').innerHTML = properties.length
      ? `<strong>${properties.length}</strong> VA-eligible multi-unit properties found`
      : 'No properties found';

    Table.render('results-tbody', pageProps, start);
    renderPagination(properties.length, page, perPage);

    const toolbar = document.getElementById('results-toolbar');
    toolbar.style.display = properties.length ? 'flex' : 'none';
  }

  function renderPagination(total, page, perPage) {
    const pages = Math.ceil(total / perPage);
    const el = document.getElementById('pagination');
    if (!el) return;
    el.style.display = pages > 1 ? 'flex' : 'none';

    const btns = [];
    btns.push(`<button class="page-btn" onclick="App.goPage(${page - 1})" ${page === 1 ? 'disabled' : ''}>‹</button>`);

    for (let i = 1; i <= pages; i++) {
      if (pages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== pages) {
        if (i === 2 || i === pages - 1) btns.push('<span style="align-self:center;color:var(--gray-mid)">…</span>');
        continue;
      }
      btns.push(`<button class="page-btn ${i === page ? 'active' : ''}" onclick="App.goPage(${i})">${i}</button>`);
    }

    btns.push(`<button class="page-btn" onclick="App.goPage(${page + 1})" ${page === pages ? 'disabled' : ''}>›</button>`);
    el.innerHTML = btns.join('');
  }

  function goPage(p) {
    const maxPage = Math.ceil(state.properties.length / 20);
    if (p < 1 || p > maxPage) return;
    state.page = p;
    renderResults();
    document.getElementById('results-area').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setLoadingState(loading) {
    const btn = document.getElementById('search-btn');
    btn.disabled = loading;
    btn.textContent = loading ? 'Searching…' : '🔍  Search';

    const tbody = document.getElementById('results-tbody');
    if (loading) {
      const cols = 10;
      tbody.innerHTML = `<tr><td colspan="${cols}" style="padding:0">
        <div class="state-panel">
          <div class="spinner"></div>
          <p>Searching for VA-eligible properties…</p>
        </div></td></tr>`;
      document.getElementById('results-toolbar').style.display = 'none';
    }
  }

  function updateDemoBanner(isDemo) {
    const banner = document.getElementById('demo-banner');
    banner.style.display = isDemo ? 'block' : 'none';
  }

  /* -------- VA Loan Calculator -------- */
  function bindCalculator() {
    const ids = ['calc-price', 'calc-down', 'calc-rate', 'calc-term', 'calc-use', 'calc-exempt'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateCalcDisplay);
    });

    document.querySelectorAll('.toggle-btn[data-term]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.toggle-btn[data-term]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('calc-term').value = btn.dataset.term;
        updateCalcDisplay();
      });
    });
  }

  function updateCalcDisplay() {
    const price   = parsePrice(document.getElementById('calc-price').value) || 400000;
    const downPct = (parseFloat(document.getElementById('calc-down').value) || 0) / 100;
    const rate    = (parseFloat(document.getElementById('calc-rate').value) || 6.5) / 100;
    const term    = parseInt(document.getElementById('calc-term').value) || 30;
    const useType = document.getElementById('calc-use').value || 'first';
    const exempt  = document.getElementById('calc-exempt').checked;

    const result = VALoan.calculate({ purchasePrice: price, downPaymentPct: downPct, annualRate: rate, termYears: term, useType, exempt });

    document.getElementById('calc-payment').textContent = Table.fmt.currency(result.monthlyPayment);
    document.getElementById('calc-loan-amount').textContent = Table.fmt.currency(result.totalLoan);
    document.getElementById('calc-funding-fee').textContent = Table.fmt.currency(result.fundingFee);
    document.getElementById('calc-fee-pct').textContent = (result.feeRate * 100).toFixed(2) + '%';
    document.getElementById('calc-total-paid').textContent = Table.fmt.currency(result.totalPaid);
    document.getElementById('calc-down-amount').textContent = Table.fmt.currency(result.downPayment);
  }

  /* -------- Modal calculator from table row -------- */
  function openCalcModal(zpid) {
    const prop = state.properties.find(p => p.zpid == zpid);
    if (!prop) return;

    document.getElementById('calc-price').value = prop.price;
    updateCalcDisplay();
    document.querySelector('.sidebar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast(`Calculator updated for ${prop.address.street}`, 'success');
  }

  /* -------- API key config -------- */
  function bindAPIConfig() {
    const toggle = document.getElementById('api-config-toggle');
    const row    = document.getElementById('api-config-row');
    const input  = document.getElementById('api-key-input');

    toggle.addEventListener('click', () => {
      const hidden = row.classList.toggle('hidden');
      toggle.textContent = hidden ? '⚙ API Settings' : '✕ Close Settings';
    });

    // Load saved key from localStorage
    const saved = localStorage.getItem('vres_api_key');
    if (saved) input.value = saved;

    input.addEventListener('input', () => {
      localStorage.setItem('vres_api_key', input.value);
    });
  }

  function getApiKey() {
    return (document.getElementById('api-key-input')?.value || '').trim();
  }

  /* -------- Helpers -------- */
  function parsePrice(val) {
    if (!val) return 0;
    return parseInt(String(val).replace(/[^0-9]/g, '')) || 0;
  }

  let toastTimer = null;
  function toast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  return { init, doSearch, goPage, openCalcModal, toast };
})();

document.addEventListener('DOMContentLoaded', App.init);
