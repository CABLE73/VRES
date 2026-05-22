/**
 * Real estate API integration for VRES.life
 * Primary: Zillow via RapidAPI  (zillow-com1.p.rapidapi.com)
 * Fallback: mock data for demo / API-key-free preview
 */

const PropertyAPI = (() => {

  const ZILLOW_HOST = 'zillow-com1.p.rapidapi.com';

  /* ---------- public API ---------- */

  /**
   * Search for multi-unit properties.
   * @param {object} params
   * @param {string} params.location    - city/state or ZIP
   * @param {string} params.unitType    - 'all' | 'duplex' | 'triplex' | 'quadplex'
   * @param {number} params.minPrice
   * @param {number} params.maxPrice
   * @param {number} params.minBeds
   * @param {string} params.sort        - 'price_asc' | 'price_desc' | 'newest'
   * @param {number} params.page
   * @param {string} params.apiKey      - RapidAPI key
   * @returns {Promise<{properties: Array, total: number, demo: boolean}>}
   */
  async function search(params) {
    const { apiKey } = params;

    if (!apiKey || apiKey.trim() === '') {
      return { properties: getMockData(params), total: getMockData(params).length, demo: true };
    }

    try {
      const result = await searchZillow(params);
      return { ...result, demo: false };
    } catch (err) {
      console.warn('Zillow API error, falling back to mock data:', err.message);
      return { properties: getMockData(params), total: getMockData(params).length, demo: true, error: err.message };
    }
  }

  /* ---------- Zillow API ---------- */

  async function searchZillow({ location, unitType, minPrice, maxPrice, minBeds, sort, page = 1, apiKey }) {
    const sortMap = {
      price_asc:  'Price_Low_High',
      price_desc: 'Price_High_Low',
      newest:     'Newest',
    };

    const qs = new URLSearchParams({
      location: location || 'Austin, TX',
      home_type: 'Multi-family',
      ...(minPrice && { minPrice: String(minPrice) }),
      ...(maxPrice && { maxPrice: String(maxPrice) }),
      ...(minBeds  && { bedsMin: String(minBeds) }),
      sort: sortMap[sort] || 'Newest',
      page: String(page),
    });

    const res = await fetch(`https://${ZILLOW_HOST}/propertyExtendedSearch?${qs}`, {
      headers: {
        'X-RapidAPI-Key':  apiKey,
        'X-RapidAPI-Host': ZILLOW_HOST,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Zillow API ${res.status}: ${body.slice(0, 120)}`);
    }

    const data = await res.json();
    const raw = data.props || [];

    const properties = raw
      .map(normalizeZillowProp)
      .filter(p => p.units !== null || unitType === 'all')
      .filter(p => {
        if (unitType === 'all') return true;
        const targets = { duplex: 2, triplex: 3, quadplex: 4 };
        return p.units === targets[unitType];
      });

    return { properties, total: data.totalResultCount || properties.length };
  }

  function normalizeZillowProp(raw) {
    const units = VALoan.detectUnits(raw.homeType, raw.address);
    const loan  = units ? VALoan.calculate({ purchasePrice: raw.price || 0 }) : null;
    const rental = units ? VALoan.estimateRentalIncome(raw.price || 0, units) : null;

    return {
      zpid:    raw.zpid,
      address: parseAddress(raw.address),
      price:   raw.price || 0,
      beds:    raw.bedrooms || '–',
      baths:   raw.bathrooms || '–',
      sqft:    raw.livingArea || null,
      units,
      homeType: raw.homeType,
      imgSrc:  raw.imgSrc || null,
      detailUrl: raw.detailUrl ? `https://www.zillow.com${raw.detailUrl}` : null,
      monthlyPayment: loan ? loan.monthlyPayment : null,
      fundingFee:     loan ? loan.fundingFee : null,
      rentalIncome:   rental,
      vaEligible:     units !== null && units >= 2 && units <= 4,
    };
  }

  function parseAddress(full) {
    if (!full) return { street: 'Unknown', cityState: '' };
    const parts = full.split(',').map(s => s.trim());
    return {
      street:    parts[0] || full,
      cityState: parts.slice(1).join(', '),
    };
  }

  /* ---------- Mock data ---------- */

  function getMockData({ unitType = 'all', minPrice = 0, maxPrice = Infinity, minBeds = 0, sort = 'newest' } = {}) {
    const all = MOCK_LISTINGS.filter(p => {
      if (p.price < minPrice || p.price > maxPrice) return false;
      if (p.beds < minBeds) return false;
      if (unitType !== 'all') {
        const map = { duplex: 2, triplex: 3, quadplex: 4 };
        if (p.units !== map[unitType]) return false;
      }
      return true;
    });

    if (sort === 'price_asc')  all.sort((a, b) => a.price - b.price);
    if (sort === 'price_desc') all.sort((a, b) => b.price - a.price);

    return all.map(p => {
      const loan   = VALoan.calculate({ purchasePrice: p.price });
      const rental = VALoan.estimateRentalIncome(p.price, p.units);
      return {
        ...p,
        monthlyPayment: loan.monthlyPayment,
        fundingFee:     loan.fundingFee,
        rentalIncome:   rental,
        vaEligible:     true,
        detailUrl:      null,
        imgSrc:         null,
      };
    });
  }

  const MOCK_LISTINGS = [
    {
      zpid: 'mock-1',
      address: { street: '1842 Oak Grove Ln', cityState: 'Austin, TX 78702' },
      price: 485000, beds: 4, baths: 3, sqft: 2100, units: 2,
      homeType: 'Duplex',
    },
    {
      zpid: 'mock-2',
      address: { street: '3310 Magnolia Blvd', cityState: 'San Antonio, TX 78201' },
      price: 310000, beds: 6, baths: 4, sqft: 2600, units: 3,
      homeType: 'Triplex',
    },
    {
      zpid: 'mock-3',
      address: { street: '509 Veteran Way', cityState: 'Dallas, TX 75201' },
      price: 620000, beds: 8, baths: 6, sqft: 3800, units: 4,
      homeType: 'Quadplex',
    },
    {
      zpid: 'mock-4',
      address: { street: '7712 Patriot Dr', cityState: 'Houston, TX 77001' },
      price: 390000, beds: 4, baths: 2.5, sqft: 1900, units: 2,
      homeType: 'Duplex',
    },
    {
      zpid: 'mock-5',
      address: { street: '2205 Liberty St', cityState: 'Fort Worth, TX 76101' },
      price: 275000, beds: 6, baths: 3, sqft: 2200, units: 3,
      homeType: 'Triplex',
    },
    {
      zpid: 'mock-6',
      address: { street: '4490 Freedom Ave', cityState: 'El Paso, TX 79901' },
      price: 349000, beds: 8, baths: 4, sqft: 3200, units: 4,
      homeType: 'Quadplex',
    },
    {
      zpid: 'mock-7',
      address: { street: '815 Ranger Ct', cityState: 'Corpus Christi, TX 78401' },
      price: 298000, beds: 4, baths: 2, sqft: 1750, units: 2,
      homeType: 'Duplex',
    },
    {
      zpid: 'mock-8',
      address: { street: '1122 Eagle Pass Rd', cityState: 'Killeen, TX 76541' },
      price: 255000, beds: 6, baths: 3, sqft: 2050, units: 3,
      homeType: 'Triplex',
    },
    {
      zpid: 'mock-9',
      address: { street: '3380 Valor Blvd', cityState: 'Waco, TX 76701' },
      price: 415000, beds: 8, baths: 5, sqft: 3400, units: 4,
      homeType: 'Quadplex',
    },
    {
      zpid: 'mock-10',
      address: { street: '660 Stars & Stripes Dr', cityState: 'San Marcos, TX 78666' },
      price: 520000, beds: 4, baths: 3, sqft: 2350, units: 2,
      homeType: 'Duplex',
    },
    {
      zpid: 'mock-11',
      address: { street: '228 Honor Guard Ln', cityState: 'Lubbock, TX 79401' },
      price: 195000, beds: 6, baths: 3, sqft: 1980, units: 3,
      homeType: 'Triplex',
    },
    {
      zpid: 'mock-12',
      address: { street: '5501 Blue Star Hwy', cityState: 'Amarillo, TX 79101' },
      price: 289000, beds: 8, baths: 4, sqft: 2900, units: 4,
      homeType: 'Quadplex',
    },
  ];

  return { search };
})();
