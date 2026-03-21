/* ==========================================
   EMI CALCULATOR
   ========================================== */

class EMICalculator {
  constructor() {
    this.principal = 0;
    this.annualRate = 12; // Default 12% per annum
    this.months = 12;
    this.result = null;
  }

  // Calculate EMI using formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  calculate(principal, annualRate, months) {
    this.principal = principal;
    this.annualRate = annualRate;
    this.months = months;

    const monthlyRate = annualRate / 100 / 12;
    
    if (monthlyRate === 0) {
      // If 0% interest
      this.result = {
        emi: Math.ceil(principal / months),
        totalAmount: principal,
        totalInterest: 0,
        months: months,
        monthlyRate: 0
      };
    } else {
      const numerator = principal * monthlyRate * Math.pow(1 + monthlyRate, months);
      const denominator = Math.pow(1 + monthlyRate, months) - 1;
      const emi = Math.ceil(numerator / denominator);
      
      this.result = {
        emi: emi,
        totalAmount: Math.ceil(emi * months),
        totalInterest: Math.ceil(emi * months - principal),
        months: months,
        monthlyRate: monthlyRate,
        principal: principal,
        annualRate: annualRate
      };
    }
    
    return this.result;
  }

  // Get amortization schedule (month-wise breakdown)
  getAmortizationSchedule() {
    if (!this.result) return [];

    const schedule = [];
    let remainingBalance = this.principal;
    const monthlyRate = this.annualRate / 100 / 12;
    const emi = this.result.emi;

    for (let month = 1; month <= this.months; month++) {
      const interest = Math.ceil(remainingBalance * monthlyRate);
      const principal = emi - interest;
      remainingBalance = Math.max(0, remainingBalance - principal);

      schedule.push({
        month,
        emi,
        principal,
        interest,
        balance: remainingBalance
      });
    }

    return schedule;
  }

  // Calculate affordable monthly EMI
  getAffordableEMI(monthlyIncome, maxPercentage = 40) {
    const maxAffordable = Math.floor((monthlyIncome * maxPercentage) / 100);
    return {
      maxAffordableEMI: maxAffordable,
      percentage: maxPercentage,
      monthlyIncome: monthlyIncome
    };
  }

  // Calculate principal from EMI
  getPrincipalFromEMI(emi, monthlyRate, months) {
    if (monthlyRate === 0) {
      return emi * months;
    }
    const numerator = emi * (Math.pow(1 + monthlyRate, months) - 1);
    const denominator = monthlyRate * Math.pow(1 + monthlyRate, months);
    return Math.floor(numerator / denominator);
  }

  // Get result
  getResult() {
    return this.result;
  }

  // Format currency
  static formatCurrency(amount, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  }

  // Get EMI breakdown
  getEMIBreakdown() {
    if (!this.result) return null;

    const { emi, totalInterest, principal } = this.result;

    return {
      monthlyEMI: emi,
      principal: principal,
      totalInterest: totalInterest,
      principalPercentage: Math.round((principal / (principal + totalInterest)) * 100),
      interestPercentage: Math.round((totalInterest / (principal + totalInterest)) * 100)
    };
  }

  // Compare different EMI options
  static compareOptions(principal, options) {
    // options = [{months: 12, rate: 12}, {months: 24, rate: 12}]
    const comparisons = [];
    
    options.forEach(option => {
      const calculator = new EMICalculator();
      const result = calculator.calculate(principal, option.rate, option.months);
      comparisons.push({
        months: option.months,
        rate: option.rate,
        emi: result.emi,
        totalAmount: result.totalAmount,
        totalInterest: result.totalInterest,
        savingsVsLongest: comparisons.length > 0 
          ? Math.max(...comparisons.map(c => c.totalInterest)) - result.totalInterest 
          : 0
      });
    });

    return comparisons;
  }
}

/* ==========================================
   ZERO COST EMI CALCULATOR
   ========================================== */

class ZeroCostEMICalculator extends EMICalculator {
  constructor() {
    super();
    this.discountPercentage = 0;
  }

  calculate(principal, months) {
    // Zero cost EMI - interest is absorbed by platform
    const monthlyRate = 0;
    
    this.result = {
      emi: Math.ceil(principal / months),
      totalAmount: principal,
      totalInterest: 0,
      months: months,
      monthlyRate: 0,
      isZeroCost: true,
      discountPercentage: this.discountPercentage
    };

    return this.result;
  }

  getZeroCostBenefit(normalRate, normalMonths) {
    const normalCalculator = new EMICalculator();
    const normalResult = normalCalculator.calculate(this.principal, normalRate, normalMonths);
    
    const savedInterest = normalResult.totalInterest - this.result.totalInterest;
    this.discountPercentage = Math.round((savedInterest / normalResult.totalInterest) * 100);

    return {
      savedInterest: savedInterest,
      savingsPercentage: this.discountPercentage,
      normalEMI: normalResult.emi,
      zeroCostEMI: this.result.emi
    };
  }
}

/* ==========================================
   PAYMENT CALCULATOR
   ========================================== */

class PaymentCalculator {
  constructor() {
    this.items = [];
    this.discounts = [];
    this.taxes = [];
    this.shippingCost = 0;
  }

  addItem(name, price, quantity = 1) {
    this.items.push({
      name,
      price,
      quantity,
      total: price * quantity
    });
  }

  removeItem(index) {
    this.items.splice(index, 1);
  }

  addDiscount(name, amount, isPercentage = false) {
    this.discounts.push({
      name,
      amount,
      isPercentage
    });
  }

  addTax(name, percentage) {
    this.taxes.push({
      name,
      percentage
    });
  }

  setShipping(cost) {
    this.shippingCost = cost;
  }

  getSubtotal() {
    return this.items.reduce((sum, item) => sum + item.total, 0);
  }

  getDiscountAmount() {
    const subtotal = this.getSubtotal();
    return this.discounts.reduce((sum, discount) => {
      if (discount.isPercentage) {
        return sum + (subtotal * discount.amount / 100);
      }
      return sum + discount.amount;
    }, 0);
  }

  getTaxableAmount() {
    return this.getSubtotal() - this.getDiscountAmount() + this.shippingCost;
  }

  getTaxAmount() {
    const taxableAmount = this.getTaxableAmount();
    return this.taxes.reduce((sum, tax) => {
      return sum + (taxableAmount * tax.percentage / 100);
    }, 0);
  }

  getTotal() {
    return this.getSubtotal() - this.getDiscountAmount() + this.getTaxAmount() + this.shippingCost;
  }

  getBreakdown() {
    return {
      subtotal: this.getSubtotal(),
      discounts: this.getDiscountAmount(),
      shipping: this.shippingCost,
      taxes: this.getTaxAmount(),
      total: this.getTotal(),
      items: this.items,
      discountDetails: this.discounts,
      taxDetails: this.taxes
    };
  }

  clear() {
    this.items = [];
    this.discounts = [];
    this.taxes = [];
    this.shippingCost = 0;
  }
}

/* ==========================================
   PRICING & DISCOUNT ENGINE
   ========================================== */

class PricingEngine {
  static calculateDiscount(originalPrice, discountType, discountValue) {
    if (discountType === 'percentage') {
      return Math.floor(originalPrice * (discountValue / 100));
    } else if (discountType === 'fixed') {
      return discountValue;
    }
    return 0;
  }

  static getDiscountedPrice(originalPrice, discountType, discountValue) {
    const discount = this.calculateDiscount(originalPrice, discountType, discountValue);
    return Math.max(0, originalPrice - discount);
  }

  static calculateBulkDiscount(quantity, pricePerUnit) {
    let discount = 0;
    
    if (quantity >= 100) discount = 0.20; // 20% for 100+
    else if (quantity >= 50) discount = 0.15; // 15% for 50-99
    else if (quantity >= 20) discount = 0.10; // 10% for 20-49
    else if (quantity >= 10) discount = 0.05; // 5% for 10-19
    
    const totalCost = quantity * pricePerUnit;
    const discountAmount = totalCost * discount;
    
    return {
      quantity,
      pricePerUnit,
      subtotal: totalCost,
      discountPercentage: discount * 100,
      discountAmount: Math.floor(discountAmount),
      finalTotal: Math.floor(totalCost - discountAmount)
    };
  }

  static calculateProgressiveDiscount(price, tier) {
    // Tier-based discounts
    const tiers = {
      'bronze': 0,
      'silver': 0.05,
      'gold': 0.10,
      'platinum': 0.15,
      'diamond': 0.20
    };

    const discount = tiers[tier.toLowerCase()] || 0;
    return {
      originalPrice: price,
      discountPercentage: discount * 100,
      discountAmount: Math.floor(price * discount),
      finalPrice: Math.floor(price * (1 - discount)),
      tier: tier
    };
  }

  static calculateCourseBundle(courses) {
    // courses = [{price: 5000, name: 'Course 1'}, ...]
    const totalPrice = courses.reduce((sum, course) => sum + course.price, 0);
    const bundleDiscount = 0.15; // 15% bundle discount
    const discountAmount = Math.floor(totalPrice * bundleDiscount);
    
    return {
      courses: courses,
      totalPrice: totalPrice,
      bundleDiscount: bundleDiscount * 100,
      discountAmount: discountAmount,
      finalPrice: totalPrice - discountAmount,
      savingsAmount: discountAmount
    };
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    EMICalculator, 
    ZeroCostEMICalculator, 
    PaymentCalculator,
    PricingEngine
  };
}
