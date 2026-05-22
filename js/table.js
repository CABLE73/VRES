/**
 * Results table rendering & interaction for VRES.life
 */

const Table = (() => {

  let _sortKey    = null;
  let _sortDir    = 'asc';
  let _properties = [];
  let _onSort     = null;

  const COLUMNS = [
    { key: 'num',     label: '#',             sortable: false, cls: 'col-num' },
    { key: 'img',     label: 'Photo',         sortable: false },
    { key: 'address', label: 'Address',       sortable: true,  cls: 'col-address' },
    { key: 'type',    label: 'Type',          sortable: true },
    { key: 'price',   label: 'List Price',    sortable: true },
    { key: 'beds',    label: 'Bd/Ba',         sortable: true },
    { key: 'sqft',    label: 'Sq Ft',         sortable: true },
    { key: 'payment', label: 'Est. VA Payment/mo', sortable: true },
    { key: 'rental',  label: 'Est. Rental Income', sortable: true },
    { key: 'actions', label: 'Actions',       sortable: false },
  ];

  function init(tableId, onSortCallback) {
    _onSort = onSortCallback;
    const thead = document.querySelector(`#${tableId} thead tr`);
    if (!thead) return;

    thead.innerHTML = COLUMNS.map(col =>
      `<th class="${col.sortable ? 'sortable' : ''} ${col.cls || ''}"
           data-key="${col.key}"
           title="${col.sortable ? 'Click to sort' : ''}">${col.label}</th>`
    ).join('');

    thead.querySelectorAll('th[data-key]').forEach(th => {
      if (!th.classList.contains('sortable')) return;
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (_sortKey === key) {
          _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          _sortKey = key;
          _sortDir = 'asc';
        }
        updateSortIndicators(tableId);
        if (_onSort) _onSort(_sortKey, _sortDir);
      });
    });
  }

  function updateSortIndicators(tableId) {
    document.querySelectorAll(`#${tableId} th`).forEach(th => {
      th.classList.remove('sorted-asc', 'sorted-desc');
      if (th.dataset.key === _sortKey) {
        th.classList.add(_sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
      }
    });
  }

  function render(tbodyId, properties, startNum = 1) {
    _properties = properties;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!properties.length) {
      tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}" style="padding:0">
        <div class="state-panel">
          <div class="state-icon">🏠</div>
          <h3>No properties found</h3>
          <p>Try adjusting your filters or searching a different location.</p>
        </div></td></tr>`;
      return;
    }

    tbody.innerHTML = properties.map((p, i) => buildRow(p, startNum + i)).join('');
  }

  function buildRow(p, num) {
    const units      = p.units;
    const unitLabel  = units ? VALoan.unitLabel(units) : 'Multi-family';
    const badgeCls   = units ? VALoan.unitBadgeClass(units) : 'type-multi';
    const price      = fmt.currency(p.price);
    const payment    = p.monthlyPayment ? fmt.currency(p.monthlyPayment) + '/mo' : '–';
    const rental     = p.rentalIncome   ? fmt.currency(p.rentalIncome.monthly) + '/mo' : '–';
    const rentalNote = p.rentalIncome   ? `(${p.rentalIncome.rentableUnits} unit${p.rentalIncome.rentableUnits > 1 ? 's' : ''} rented)` : '';
    const sqft       = p.sqft ? fmt.number(p.sqft) + ' ft²' : '–';
    const imgCell    = p.imgSrc
      ? `<img src="${esc(p.imgSrc)}" alt="property" class="prop-img" loading="lazy">`
      : `<div class="prop-img-placeholder">🏘</div>`;

    const linkCell = p.detailUrl
      ? `<a href="${esc(p.detailUrl)}" target="_blank" rel="noopener">View ↗</a>`
      : `<a href="#" onclick="App.openCalcModal(${JSON.stringify(p.zpid)}); return false">Estimate</a>`;

    return `
      <tr data-zpid="${esc(p.zpid)}">
        <td class="col-num">${num}</td>
        <td>${imgCell}</td>
        <td class="col-address">
          <div class="prop-address-main">${esc(p.address.street)}</div>
          <div class="prop-address-sub">${esc(p.address.cityState)}</div>
        </td>
        <td><span class="type-badge ${badgeCls}">${unitLabel}</span></td>
        <td class="price-cell">${price}</td>
        <td>${p.beds}bd / ${p.baths}ba</td>
        <td>${sqft}</td>
        <td class="payment-cell">${payment}</td>
        <td class="rental-cell">
          ${rental}
          ${rentalNote ? `<div class="rental-est">${rentalNote} • est.</div>` : ''}
        </td>
        <td class="action-cell">${linkCell}</td>
      </tr>`;
  }

  function sortProperties(props, key, dir) {
    const sorted = [...props];
    const mult = dir === 'asc' ? 1 : -1;
    const getVal = (p) => {
      switch (key) {
        case 'address': return p.address.street.toLowerCase();
        case 'type':    return p.units || 0;
        case 'price':   return p.price;
        case 'beds':    return parseFloat(p.beds) || 0;
        case 'sqft':    return p.sqft || 0;
        case 'payment': return p.monthlyPayment || 0;
        case 'rental':  return p.rentalIncome ? p.rentalIncome.monthly : 0;
        default:        return 0;
      }
    };
    sorted.sort((a, b) => {
      const va = getVal(a), vb = getVal(b);
      if (typeof va === 'string') return va.localeCompare(vb) * mult;
      return (va - vb) * mult;
    });
    return sorted;
  }

  function exportCSV(properties) {
    const headers = ['#', 'Address', 'City/State', 'Type', 'List Price', 'Beds', 'Baths', 'Sq Ft',
      'Est VA Payment/mo', 'VA Funding Fee', 'Est Rental Income/mo', 'Rentable Units'];
    const rows = properties.map((p, i) => [
      i + 1,
      p.address.street,
      p.address.cityState,
      p.units ? VALoan.unitLabel(p.units) : 'Multi-family',
      p.price,
      p.beds,
      p.baths,
      p.sqft || '',
      p.monthlyPayment ? Math.round(p.monthlyPayment) : '',
      p.fundingFee     ? Math.round(p.fundingFee) : '',
      p.rentalIncome   ? p.rentalIncome.monthly : '',
      p.rentalIncome   ? p.rentalIncome.rentableUnits : '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `VRES-VA-Properties-${new Date().toISOString().slice(0,10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  /* helpers */
  const fmt = {
    currency: (n) => n ? '$' + Math.round(n).toLocaleString('en-US') : '–',
    number:   (n) => n ? n.toLocaleString('en-US') : '–',
    pct:      (n) => n ? (n * 100).toFixed(2) + '%' : '–',
  };

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { init, render, sortProperties, exportCSV, fmt };
})();
