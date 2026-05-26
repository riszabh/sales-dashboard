// sample-data.js
// Provides high-fidelity, realistic sample datasets for the Sales & Revenue Analysis Dashboard.
// Avoids random drift by using deterministic algorithms for consistent, beautiful trend lines.

const SampleDataGenerator = {
  // Generates TechStore Global Sales Dataset (approx. 200 transactions)
  generateEcommerceStore: function() {
    const products = [
      { name: "ProBook 15 X", category: "Laptops", basePrice: 1299, profitMargin: 0.28 },
      { name: "AeroTab Ultra 11", category: "Laptops", basePrice: 799, profitMargin: 0.32 },
      { name: "Zenith ANC Headphones", category: "Audio", basePrice: 299, profitMargin: 0.45 },
      { name: "EchoBuds Air", category: "Audio", basePrice: 129, profitMargin: 0.50 },
      { name: "VividView 27\" Monitor", category: "Accessories", basePrice: 349, profitMargin: 0.22 },
      { name: "Apex Mechanical Keyboard", category: "Accessories", basePrice: 149, profitMargin: 0.40 },
      { name: "SwiftFlow Wireless Mouse", category: "Accessories", basePrice: 79, profitMargin: 0.45 },
      { name: "NovaHub Smart Speaker", category: "Smart Home", basePrice: 99, profitMargin: 0.35 },
      { name: "AuraLink Smart Bulb Pack", category: "Smart Home", basePrice: 49, profitMargin: 0.55 },
      { name: "SpectraVR Headset", category: "Smart Home", basePrice: 599, profitMargin: 0.25 }
    ];

    const regions = ["North America", "Europe", "Asia-Pacific", "Latin America"];
    const records = [];
    let orderIdCounter = 1001;

    // Cover a 12-month period from Jan 2025 to Dec 2025
    const startDate = new Date(2025, 0, 1);
    const endDate = new Date(2025, 11, 31);
    const totalDays = 365;

    // Use a simple seedable LCG pseudo-random generator for reproducible deterministic data
    let seed = 42;
    function random() {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    }

    for (let day = 0; day < totalDays; day++) {
      // Seasonal sales frequency (higher sales on weekends and Q4 holiday season)
      const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const month = currentDate.getMonth();
      
      // Multiplier based on month (Holiday boost in Nov/Dec, summer lull in July/Aug)
      let monthlyBoost = 1.0;
      if (month === 11) monthlyBoost = 1.8;      // December
      else if (month === 10) monthlyBoost = 1.5; // November
      else if (month === 0) monthlyBoost = 0.9;  // January
      else if (month === 6 || month === 7) monthlyBoost = 0.85; // Summer lull
      
      const transactionsCount = Math.floor((isWeekend ? 3 : 1.5) * monthlyBoost * (1 + random() * 1.5));

      for (let t = 0; t < transactionsCount; t++) {
        // Select product with weighted bias
        const productIndex = Math.floor(random() * products.length);
        const product = products[productIndex];
        
        // Quantity sold (mostly 1-2, occasionally more for accessories)
        let maxQty = product.category === "Accessories" || product.category === "Smart Home" ? 4 : 2;
        const qty = Math.floor(1 + random() * maxQty);
        
        // Small price variation (discounts/coupons)
        const priceDeviation = 1 - (random() * 0.1); // Up to 10% discount
        const unitPrice = parseFloat((product.basePrice * priceDeviation).toFixed(2));
        const revenue = parseFloat((unitPrice * qty).toFixed(2));
        
        // Region allocation
        const region = regions[Math.floor(random() * regions.length)];
        
        // Cost of Goods Sold & Profit
        const profitMargin = product.profitMargin * (1 + (random() * 0.1 - 0.05)); // Margin fluctuation
        const profit = parseFloat((revenue * profitMargin).toFixed(2));
        
        records.push({
          "Order ID": `TX-${orderIdCounter++}`,
          "Date": currentDate.toISOString().split('T')[0],
          "Product": product.name,
          "Category": product.category,
          "Quantity": qty,
          "Unit Price": unitPrice,
          "Revenue": revenue,
          "Region": region,
          "Profit": profit
        });
      }
    }

    // Sort chronologically
    return records.sort((a, b) => new Date(a.Date) - new Date(b.Date));
  },

  // Generates SaaS Subscription Revenue Dataset (approx. 180 entries over a year)
  generateSaaSHub: function() {
    const plans = [
      { name: "Starter Plan", price: 29, tier: "Basic" },
      { name: "Professional Plan", price: 99, tier: "Pro" },
      { name: "Enterprise Suite", price: 499, tier: "Enterprise" }
    ];
    const segments = ["SMB", "Mid-Market", "Enterprise"];
    const regions = ["North America", "EMEA", "APAC"];
    const channels = ["Direct Outbound", "Inbound Marketing", "Referral", "Organic Search"];
    
    const records = [];
    let seed = 12345;
    function random() {
      const x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    }

    let customerIdCounter = 5001;

    // We will generate subscription additions, renewals, and churn events month-over-month in 2025
    for (let month = 0; month < 12; month++) {
      const year = 2025;
      const monthStr = String(month + 1).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-01`;
      
      // Let's create an compounding active subscriber base
      // Each month we acquire some new customers and churn some
      // Starter: 8-15 new per month
      // Pro: 5-10 new per month
      // Enterprise: 1-3 new per month
      
      const newCustomerCount = {
        "Basic": Math.floor(10 + random() * 12 * (1 + month * 0.05)), // growing over time
        "Pro": Math.floor(6 + random() * 8 * (1 + month * 0.07)),
        "Enterprise": Math.floor(1 + random() * 3)
      };

      Object.keys(newCustomerCount).forEach(tier => {
        const count = newCustomerCount[tier];
        const plan = plans.find(p => p.tier === tier);
        
        for (let i = 0; i < count; i++) {
          const region = regions[Math.floor(random() * regions.length)];
          const segment = segments[tier === "Basic" ? 0 : (tier === "Pro" ? 1 : 2)];
          const channel = channels[Math.floor(random() * channels.length)];
          const contractLength = tier === "Enterprise" ? 12 : (random() > 0.5 ? 12 : 1);
          
          // Discount on annual contracts
          let monthlyRevenue = plan.price;
          if (contractLength === 12) {
            monthlyRevenue = parseFloat((plan.price * 0.85).toFixed(2)); // 15% discount for annual
          }
          
          records.push({
            "Date": dateStr,
            "Customer ID": `SUB-${customerIdCounter++}`,
            "Tier": plan.tier,
            "Plan Name": plan.name,
            "Segment": segment,
            "Billing Interval": contractLength === 12 ? "Annual" : "Monthly",
            "Monthly Revenue": monthlyRevenue,
            "Annual Contract Value": parseFloat((monthlyRevenue * 12).toFixed(2)),
            "Region": region,
            "Marketing Channel": channel,
            "Status": "New"
          });
        }
      });

      // Also generate random active recurring monthly renewals/additions from existing customers
      // For visual simplicity, we will emit "Active Subscription Revenue" records for everyone currently active.
      // But instead of generating individual transactional lines, we will output active customer lines to give a realistic look
      const existingCount = Math.floor(40 + month * 12);
      for (let e = 0; e < existingCount; e++) {
        const plan = plans[Math.floor(random() * plans.length)];
        const region = regions[Math.floor(random() * regions.length)];
        const segment = segments[plan.tier === "Basic" ? 0 : (plan.tier === "Pro" ? 1 : 2)];
        const channel = channels[Math.floor(random() * channels.length)];
        
        records.push({
          "Date": dateStr,
          "Customer ID": `SUB-${Math.floor(4000 + e)}`,
          "Tier": plan.tier,
          "Plan Name": plan.name,
          "Segment": segment,
          "Billing Interval": random() > 0.4 ? "Annual" : "Monthly",
          "Monthly Revenue": plan.price,
          "Annual Contract Value": parseFloat((plan.price * 12).toFixed(2)),
          "Region": region,
          "Marketing Channel": channel,
          "Status": "Active"
        });
      }

      // Add a couple of Churn records to demonstrate loss tracking
      const churnCount = Math.floor(1 + random() * 4);
      for (let c = 0; c < churnCount; c++) {
        const plan = plans[Math.floor(random() * plans.length)];
        const region = regions[Math.floor(random() * regions.length)];
        
        records.push({
          "Date": dateStr,
          "Customer ID": `SUB-CHURN-${Math.floor(9000 + month * 10 + c)}`,
          "Tier": plan.tier,
          "Plan Name": plan.name,
          "Segment": plan.tier === "Basic" ? "SMB" : "Mid-Market",
          "Billing Interval": "Monthly",
          "Monthly Revenue": -plan.price, // negative revenue represents loss
          "Annual Contract Value": parseFloat((-plan.price * 12).toFixed(2)),
          "Region": region,
          "Marketing Channel": "Organic Search",
          "Status": "Churned"
        });
      }
    }

    return records;
  }
};

// Export to window object for access across HTML scripts
window.SAMPLE_DATASETS = {
  ecommerce: SampleDataGenerator.generateEcommerceStore(),
  saas: SampleDataGenerator.generateSaaSHub()
};
console.log("Sample datasets loaded. E-commerce rows:", window.SAMPLE_DATASETS.ecommerce.length, "SaaS rows:", window.SAMPLE_DATASETS.saas.length);
