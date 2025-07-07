// Tax brackets data for South African tax years
export const taxBracketsData = {
  2024: {
    brackets: [
      { min: 0, max: 237100, rate: 0.18 },
      { min: 237100, max: 370500, rate: 0.26 },
      { min: 370500, max: 512800, rate: 0.31 },
      { min: 512800, max: 673000, rate: 0.36 },
      { min: 673000, max: 857900, rate: 0.39 },
      { min: 857900, max: 1817600, rate: 0.41 },
      { min: 1817600, max: Infinity, rate: 0.45 }
    ],
    rebates: {
      under65: 17235,
      under75: 17235 + 9444,
      over75: 17235 + 9444 + 3145
    }
  },
  2025: {
    brackets: [
      { min: 0, max: 262250, rate: 0.18 },
      { min: 262250, max: 410460, rate: 0.26 },
      { min: 410460, max: 567890, rate: 0.31 },
      { min: 567890, max: 744800, rate: 0.36 },
      { min: 744800, max: 949320, rate: 0.39 },
      { min: 949320, max: 2011300, rate: 0.41 },
      { min: 2011300, max: Infinity, rate: 0.45 }
    ],
    rebates: {
      under65: 19071,
      under75: 19071 + 10455,
      over75: 19071 + 10455 + 3485
    }
  },
  2026: {
    brackets: [
      { min: 0, max: 273450, rate: 0.18 },
      { min: 273450, max: 428550, rate: 0.26 },
      { min: 428550, max: 593300, rate: 0.31 },
      { min: 593300, max: 778150, rate: 0.36 },
      { min: 778150, max: 991300, rate: 0.39 },
      { min: 991300, max: 2100000, rate: 0.41 },
      { min: 2100000, max: Infinity, rate: 0.45 }
    ],
    rebates: {
      under65: 19920,
      under75: 19920 + 10920,
      over75: 19920 + 10920 + 3640
    }
  }
};

// Calculate tax based on South African tax brackets
export const calculateTax = (income, year, ageCategory) => {
  const data = taxBracketsData[year];
  if (!data) return { tax: 0, grossTax: 0, rebates: 0, effectiveRate: 0, marginalRate: 0 };

  let grossTax = 0;
  let marginalRate = 0;

  for (const bracket of data.brackets) {
    if (income > bracket.min) {
      const taxableInBracket = Math.min(income, bracket.max) - bracket.min;
      grossTax += taxableInBracket * bracket.rate;
      marginalRate = bracket.rate * 100;
    }
  }

  const rebates = data.rebates[ageCategory] || 0;
  const netTax = Math.max(0, grossTax - rebates);
  const effectiveRate = income > 0 ? (netTax / income) * 100 : 0;

  return {
    tax: netTax,
    grossTax,
    rebates,
    effectiveRate,
    marginalRate
  };
};