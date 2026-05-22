/**
 * VA Loan calculation utilities for VRES.life
 * Covers multi-unit (2–4 unit) property scenarios.
 */

const VALoan = (() => {

  // Funding fee table (2024 rates)
  const FUNDING_FEES = {
    first: {
      low:  0.0215,  // < 5% down
      mid:  0.0150,  // 5–9.99% down
      high: 0.0125,  // >= 10% down
    },
    subsequent: {
      low:  0.0330,
      mid:  0.0150,
      high: 0.0125,
    },
  };

  function getFundingFeeRate(useType, downPct) {
    const tier = downPct >= 0.10 ? 'high' : downPct >= 0.05 ? 'mid' : 'low';
    return FUNDING_FEES[useType][tier];
  }

  /**
   * Calculate monthly P&I payment.
   * @param {number} principal - Loan amount in dollars
   * @param {number} annualRate - Annual interest rate (e.g., 0.065 for 6.5%)
   * @param {number} termYears - Loan term in years
   * @returns {number} Monthly payment
   */
  function monthlyPayment(principal, annualRate, termYears) {
    if (annualRate === 0) return principal / (termYears * 12);
    const r = annualRate / 12;
    const n = termYears * 12;
    return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }

  /**
   * Full VA loan breakdown for a purchase.
   * @param {object} params
   * @param {number} params.purchasePrice
   * @param {number} params.downPaymentPct  - 0 to 1 (0 = no down payment)
   * @param {number} params.annualRate      - e.g., 0.065
   * @param {number} params.termYears       - 15 or 30
   * @param {string} params.useType         - 'first' | 'subsequent'
   * @param {boolean} params.exempt         - true if VA funding fee exempt
   * @returns {object} Full breakdown
   */
  function calculate(params) {
    const {
      purchasePrice,
      downPaymentPct = 0,
      annualRate = 0.065,
      termYears = 30,
      useType = 'first',
      exempt = false,
    } = params;

    const downPayment  = purchasePrice * downPaymentPct;
    const baseLoan     = purchasePrice - downPayment;
    const feeRate      = exempt ? 0 : getFundingFeeRate(useType, downPaymentPct);
    const fundingFee   = baseLoan * feeRate;
    const totalLoan    = baseLoan + fundingFee;
    const payment      = monthlyPayment(totalLoan, annualRate, termYears);
    const totalPaid    = payment * termYears * 12;
    const totalInterest = totalPaid - totalLoan;

    return {
      purchasePrice,
      downPayment,
      downPaymentPct,
      baseLoan,
      feeRate,
      fundingFee,
      totalLoan,
      annualRate,
      termYears,
      monthlyPayment: payment,
      totalPaid,
      totalInterest,
      exempt,
    };
  }

  /**
   * Estimate rental income potential for a multi-unit property.
   * Uses a rough yield-based model. Always label as estimated.
   * @param {number} purchasePrice
   * @param {number} units  - total units (2, 3, or 4)
   * @returns {object} { perUnit, occupied, monthly, annual, capRate }
   */
  function estimateRentalIncome(purchasePrice, units) {
    // Gross rent multiplier approach: 0.7% of value/month total is a common estimate
    // Then subtract owner-occupied unit
    const grossMonthly = purchasePrice * 0.007;
    const perUnit      = grossMonthly / units;
    const rentableUnits = units - 1; // owner occupies one
    const monthly      = perUnit * rentableUnits;
    const annual       = monthly * 12;
    const capRate      = annual / purchasePrice;

    return {
      perUnit: Math.round(perUnit),
      rentableUnits,
      monthly:  Math.round(monthly),
      annual:   Math.round(annual),
      capRate,
    };
  }

  /**
   * VA allows 75% of net rental income to offset the mortgage for DTI purposes.
   * @param {number} grossRental
   * @returns {number}
   */
  function vaRentalOffset(grossRental) {
    return grossRental * 0.75;
  }

  /**
   * Determine unit count category label.
   */
  function unitLabel(units) {
    const map = { 2: 'Duplex', 3: 'Triplex', 4: 'Quadplex' };
    return map[units] || `${units}-Unit`;
  }

  function unitBadgeClass(units) {
    const map = { 2: 'type-duplex', 3: 'type-triplex', 4: 'type-quadplex' };
    return map[units] || 'type-multi';
  }

  /**
   * Detect unit count from property type string (API data).
   * Returns 2, 3, 4, or null if unknown.
   */
  function detectUnits(homeType, description) {
    const text = `${homeType || ''} ${description || ''}`.toLowerCase();
    if (/quadplex|quad[- ]?plex|4[- ]?plex|four[- ]?plex|4[- ]?unit/.test(text)) return 4;
    if (/triplex|tri[- ]?plex|3[- ]?plex|three[- ]?plex|3[- ]?unit/.test(text)) return 3;
    if (/duplex|du[- ]?plex|2[- ]?plex|two[- ]?plex|2[- ]?unit/.test(text)) return 2;
    if (/multi[- ]?family|multifamily/.test(text)) return null;
    return null;
  }

  return { calculate, monthlyPayment, estimateRentalIncome, vaRentalOffset, unitLabel, unitBadgeClass, detectUnits, getFundingFeeRate };
})();
