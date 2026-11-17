import { BudgetConfig, Transaction, UserAccount } from '../types/finance';

export const DEMO_USERS: Record<'professional' | 'student', UserAccount> = {
  professional: {
    id: 'usr_arjun',
    name: 'Arjun Mehta',
    email: 'arjun.mehta@smartspend.in',
    roleLabel: 'Young Professional',
    city: 'Bengaluru',
    avatarUrl: '/src/assets/images/avatar_user_profile_1794909195165.jpg',
    personaKey: 'professional',
  },
  student: {
    id: 'usr_ananya',
    name: 'Ananya Sharma',
    email: 'ananya.sharma@smartspend.in',
    roleLabel: 'College Student',
    city: 'Pune',
    personaKey: 'student',
  },
};

export const PROFESSIONAL_BUDGET: BudgetConfig = {
  overallMonthlyLimit: 62000,
  alertThresholdPercent: 80,
  categoryLimits: {
    Housing: 24000,
    'Food and Dining': 11000,
    Transportation: 4500,
    Shopping: 7000,
    'Bills and Utilities': 4500,
    Entertainment: 2500,
    Healthcare: 2500,
    Travel: 4000,
    'Personal Care': 2000,
  },
};

export const STUDENT_BUDGET: BudgetConfig = {
  overallMonthlyLimit: 20000,
  alertThresholdPercent: 80,
  categoryLimits: {
    Housing: 7500,
    'Food and Dining': 5200,
    Transportation: 1800,
    Shopping: 2000,
    Education: 1800,
    'Bills and Utilities': 900,
    Entertainment: 800,
  },
};

function tx(
  id: string,
  userId: string,
  date: string,
  description: string,
  amount: number,
  type: 'expense' | 'income',
  category: Transaction['category'],
  paymentMethod: Transaction['paymentMethod'],
  confidence = 0.94,
  needsReview = false,
  notes?: string
): Transaction {
  return {
    id,
    userId,
    description,
    amount,
    date,
    type,
    category,
    predictedCategory: category,
    confidence,
    needsReview,
    manuallyCorrected: false,
    paymentMethod,
    notes,
    source: 'seed',
    createdAt: `${date}T10:15:00.000Z`,
  };
}

export function getSeedTransactions(persona: 'professional' | 'student'): Transaction[] {
  if (persona === 'student') {
    const uid = DEMO_USERS.student.id;
    return [
      // 2026-08 to 2026-11 Student Dataset
      tx('st_01', uid, '2026-08-01', 'Monthly Family Allowance NEFT', 18000, 'income', 'Income', 'NetBanking', 0.97),
      tx('st_02', uid, '2026-08-03', 'Hostel Rent & Mess Advance', 7500, 'expense', 'Housing', 'UPI', 0.96),
      tx('st_03', uid, '2026-08-07', 'Pune Metro Card Top-up', 600, 'expense', 'Transportation', 'UPI', 0.95),
      tx('st_04', uid, '2026-08-12', 'Zomato Late Night Order', 420, 'expense', 'Food and Dining', 'UPI', 0.95),
      tx('st_05', uid, '2026-08-18', 'Sapna Book House Textbooks', 1350, 'expense', 'Education', 'Debit Card', 0.94),
      tx('st_06', uid, '2026-08-24', 'Jio Prepaid 84-Day Plan', 719, 'expense', 'Bills and Utilities', 'UPI', 0.96),

      tx('st_07', uid, '2026-09-01', 'Monthly Family Allowance NEFT', 18000, 'income', 'Income', 'NetBanking', 0.97),
      tx('st_08', uid, '2026-09-02', 'Hostel Rent & Mess Advance', 7500, 'expense', 'Housing', 'UPI', 0.96),
      tx('st_09', uid, '2026-09-08', 'Campus Canteen & Tea', 1120, 'expense', 'Food and Dining', 'UPI', 0.91),
      tx('st_10', uid, '2026-09-14', 'Rapido Bike Commute', 380, 'expense', 'Transportation', 'UPI', 0.93),
      tx('st_11', uid, '2026-09-20', 'Spotify Student & Netflix Share', 349, 'expense', 'Entertainment', 'UPI', 0.95),
      tx('st_12', uid, '2026-09-26', 'Myntra Sneakers Sale', 1950, 'expense', 'Shopping', 'Debit Card', 0.94),

      tx('st_13', uid, '2026-10-01', 'Monthly Family Allowance NEFT', 18000, 'income', 'Income', 'NetBanking', 0.97),
      tx('st_14', uid, '2026-10-03', 'Hostel Rent & Mess Advance', 7500, 'expense', 'Housing', 'UPI', 0.96),
      tx('st_15', uid, '2026-10-09', 'Design Internship Stipend', 6500, 'income', 'Income', 'NetBanking', 0.96),
      tx('st_16', uid, '2026-10-12', 'Swiggy Group Dinner', 890, 'expense', 'Food and Dining', 'UPI', 0.95),
      tx('st_17', uid, '2026-10-16', 'Coursera ML Specialization Fee', 1650, 'expense', 'Education', 'Credit Card', 0.95),
      tx('st_18', uid, '2026-10-22', 'Pune Metro & Auto Commute', 740, 'expense', 'Transportation', 'UPI', 0.93),
      tx('st_19', uid, '2026-10-28', 'Apollo Pharmacy Vitamins', 480, 'expense', 'Healthcare', 'UPI', 0.94),

      // Current Month: 2026-11
      tx('st_20', uid, '2026-11-01', 'Monthly Family Allowance NEFT', 18000, 'income', 'Income', 'NetBanking', 0.97),
      tx('st_21', uid, '2026-11-02', 'Hostel Rent & Mess Advance', 7500, 'expense', 'Housing', 'UPI', 0.96),
      tx('st_22', uid, '2026-11-04', 'College Canteen Breakfasts', 680, 'expense', 'Food and Dining', 'UPI', 0.92),
      tx('st_23', uid, '2026-11-06', 'Pune Metro Monthly Pass', 850, 'expense', 'Transportation', 'UPI', 0.95),
      tx('st_24', uid, '2026-11-08', 'Design Internship Stipend', 6500, 'income', 'Income', 'NetBanking', 0.96),
      tx('st_25', uid, '2026-11-09', 'Zomato Biryani & Snacks', 540, 'expense', 'Food and Dining', 'UPI', 0.95),
      tx('st_26', uid, '2026-11-11', 'BookMyShow IMAX Ticket', 520, 'expense', 'Entertainment', 'UPI', 0.94),
      tx('st_27', uid, '2026-11-12', 'Amazon Wireless Headphones', 4890, 'expense', 'Shopping', 'Debit Card', 0.95, false, 'Noise-cancelling headset for study'),
      tx('st_28', uid, '2026-11-14', 'UPI/8829103/KAVITA STORES', 1150, 'expense', 'Other', 'UPI', 0.54, true, 'Needs category check'),
      tx('st_29', uid, '2026-11-15', 'Blinkit Groceries & Coffee', 640, 'expense', 'Food and Dining', 'UPI', 0.96),
      tx('st_30', uid, '2026-11-16', 'Jio Prepaid Recharge', 349, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    ];
  }

  // Young Professional (Arjun Mehta, Bengaluru) — 6 months: 2026-06 to 2026-11
  const uid = DEMO_USERS.professional.id;
  return [
    // June 2026
    tx('pr_0601', uid, '2026-06-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_0602', uid, '2026-06-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_0603', uid, '2026-06-05', 'Blinkit Weekly Groceries', 2650, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_0604', uid, '2026-06-08', 'BESCOM Electricity Bill', 1840, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0605', uid, '2026-06-11', 'Uber Office Commute', 1420, 'expense', 'Transportation', 'UPI', 0.95),
    tx('pr_0606', uid, '2026-06-14', 'Third Wave Coffee & Lunch', 980, 'expense', 'Food and Dining', 'UPI', 0.93),
    tx('pr_0607', uid, '2026-06-18', 'JioFiber Broadband Plan', 1179, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0608', uid, '2026-06-21', 'Amazon Home Essentials', 2490, 'expense', 'Shopping', 'Credit Card', 0.95),
    tx('pr_0609', uid, '2026-06-24', 'Netflix & Spotify Duo', 828, 'expense', 'Entertainment', 'Credit Card', 0.96),
    tx('pr_0610', uid, '2026-06-27', 'Swiggy Dinner Orders', 2140, 'expense', 'Food and Dining', 'UPI', 0.95),

    // July 2026
    tx('pr_0701', uid, '2026-07-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_0702', uid, '2026-07-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_0703', uid, '2026-07-06', 'BigBasket Monthly Staples', 3280, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_0704', uid, '2026-07-09', 'BESCOM Electricity Bill', 1960, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0705', uid, '2026-07-12', 'Namma Metro & Uber Rides', 1680, 'expense', 'Transportation', 'UPI', 0.94),
    tx('pr_0706', uid, '2026-07-15', 'Apollo Pharmacy Wellness', 1120, 'expense', 'Healthcare', 'UPI', 0.95),
    tx('pr_0707', uid, '2026-07-18', 'JioFiber Broadband Plan', 1179, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0708', uid, '2026-07-22', 'Myntra Office Shirts', 2890, 'expense', 'Shopping', 'Credit Card', 0.94),
    tx('pr_0709', uid, '2026-07-25', 'Zomato Weekend Dining', 2450, 'expense', 'Food and Dining', 'UPI', 0.95),
    tx('pr_0710', uid, '2026-07-28', 'Cult.fit Monthly Renewal', 1650, 'expense', 'Personal Care', 'UPI', 0.95),

    // August 2026
    tx('pr_0801', uid, '2026-08-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_0802', uid, '2026-08-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_0803', uid, '2026-08-06', 'Blinkit Groceries & Dairy', 2920, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_0804', uid, '2026-08-09', 'BESCOM & Airtel Postpaid', 2680, 'expense', 'Bills and Utilities', 'UPI', 0.95),
    tx('pr_0805', uid, '2026-08-13', 'HPCL Petrol Refill', 2100, 'expense', 'Transportation', 'Credit Card', 0.95),
    tx('pr_0806', uid, '2026-08-16', 'PVR IMAX & Popcorn', 1240, 'expense', 'Entertainment', 'Credit Card', 0.95),
    tx('pr_0807', uid, '2026-08-19', 'Udemy System Design Course', 1499, 'expense', 'Education', 'Credit Card', 0.95),
    tx('pr_0808', uid, '2026-08-22', 'IRCTC Train to Chennai', 1850, 'expense', 'Travel', 'UPI', 0.96),
    tx('pr_0809', uid, '2026-08-26', 'Swiggy Instamart Snacks', 1890, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_0810', uid, '2026-08-29', 'Looks Salon Grooming', 950, 'expense', 'Personal Care', 'UPI', 0.95),

    // September 2026
    tx('pr_0901', uid, '2026-09-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_0902', uid, '2026-09-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_0903', uid, '2026-09-05', 'BigBasket Fresh Produce', 3150, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_0904', uid, '2026-09-08', 'BESCOM Electricity Bill', 1790, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0905', uid, '2026-09-11', 'Uber & Ola Airport Trips', 1940, 'expense', 'Transportation', 'UPI', 0.95),
    tx('pr_0906', uid, '2026-09-14', 'Freelance UI Advisory Payout', 12500, 'income', 'Income', 'NetBanking', 0.96),
    tx('pr_0907', uid, '2026-09-17', 'JioFiber & Airtel Postpaid', 1878, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_0908', uid, '2026-09-20', 'Decathlon Running Shoes', 3499, 'expense', 'Shopping', 'Credit Card', 0.95),
    tx('pr_0909', uid, '2026-09-24', 'Thyrocare Preventive Checkup', 1650, 'expense', 'Healthcare', 'UPI', 0.95),
    tx('pr_0910', uid, '2026-09-27', 'Zomato & Blue Tokai', 2680, 'expense', 'Food and Dining', 'UPI', 0.95),

    // October 2026
    tx('pr_1001', uid, '2026-10-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_1002', uid, '2026-10-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_1003', uid, '2026-10-05', 'Zepto Express Groceries', 2840, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_1004', uid, '2026-10-08', 'BESCOM Electricity Bill', 2120, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_1005', uid, '2026-10-10', 'HPCL Fuel & FASTag', 2250, 'expense', 'Transportation', 'Credit Card', 0.95),
    tx('pr_1006', uid, '2026-10-14', 'IndiGo Diwali Flight Booking', 6400, 'expense', 'Travel', 'Credit Card', 0.97),
    tx('pr_1007', uid, '2026-10-18', 'JioFiber Broadband Plan', 1179, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_1008', uid, '2026-10-21', 'Amazon Festive Gifts', 4600, 'expense', 'Shopping', 'Credit Card', 0.95),
    tx('pr_1009', uid, '2026-10-25', 'Swiggy Family Dinner', 3120, 'expense', 'Food and Dining', 'UPI', 0.95),
    tx('pr_1010', uid, '2026-10-29', 'BookMyShow Concert Pass', 1800, 'expense', 'Entertainment', 'UPI', 0.94),

    // Current Month: November 2026 (rich realistic dataset with 2 clear anomalies + 2 low-confidence items for review)
    tx('pr_1101', uid, '2026-11-01', 'TechCorp India Salary Credit', 92000, 'income', 'Income', 'NetBanking', 0.98),
    tx('pr_1102', uid, '2026-11-02', 'NoBroker Indiranagar Flat Rent', 23500, 'expense', 'Housing', 'NetBanking', 0.97),
    tx('pr_1103', uid, '2026-11-03', 'Blinkit Groceries & Milk', 2340, 'expense', 'Food and Dining', 'UPI', 0.96),
    tx('pr_1104', uid, '2026-11-04', 'Uber Office & Metro Trips', 1560, 'expense', 'Transportation', 'UPI', 0.95),
    tx('pr_1105', uid, '2026-11-05', 'BESCOM Electricity Bill', 2080, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_1106', uid, '2026-11-06', 'Third Wave Coffee & Lunch', 860, 'expense', 'Food and Dining', 'UPI', 0.94),
    tx('pr_1107', uid, '2026-11-08', 'JioFiber & Airtel Postpaid', 1878, 'expense', 'Bills and Utilities', 'UPI', 0.96),
    tx('pr_1108', uid, '2026-11-09', 'Croma Noise Cancelling Monitor Arm & Hub', 13800, 'expense', 'Shopping', 'Credit Card', 0.95, false, 'Work-from-home desk upgrade'),
    tx('pr_1109', uid, '2026-11-10', 'Tax Refund / Cashback Credit', 4200, 'income', 'Income', 'NetBanking', 0.91),
    tx('pr_1110', uid, '2026-11-11', 'Swiggy Team Celebration Dinner', 9450, 'expense', 'Food and Dining', 'Credit Card', 0.95, false, 'Hosted 6 friends in Koramangala'),
    tx('pr_1111', uid, '2026-11-12', 'Cult.fit & Looks Salon', 2150, 'expense', 'Personal Care', 'UPI', 0.94),
    tx('pr_1112', uid, '2026-11-13', 'Apollo Pharmacy Medicines', 920, 'expense', 'Healthcare', 'UPI', 0.95),
    tx('pr_1113', uid, '2026-11-14', 'UPI/49201948/RAVI ENTERPRISES', 1650, 'expense', 'Other', 'UPI', 0.51, true, 'Unrecognized UPI merchant string'),
    tx('pr_1114', uid, '2026-11-15', 'Netflix & BookMyShow Weekend', 1380, 'expense', 'Entertainment', 'Credit Card', 0.95),
    tx('pr_1115', uid, '2026-11-16', 'HPCL Petrol Refill', 1980, 'expense', 'Transportation', 'UPI', 0.95),
    tx('pr_1116', uid, '2026-11-16', 'UPI/7730112/BALAJI TRADERS', 1180, 'expense', 'Other', 'UPI', 0.56, true, 'Local store UPI transfer'),
  ];
}

export const SAMPLE_BANK_CSV = `Date,Description,Amount,Type,PaymentMethod
2026-11-17,Zomato Lunch Bowl,485,expense,UPI
2026-11-17,Uber Ride to MG Road,340,expense,UPI
2026-11-16,HPCL Petrol Refill,1980,expense,UPI
2026-11-15,Airtel Postpaid Bill,799,expense,NetBanking
2026-11-14,UPI/910293/KUMAR AGENCIES,1450,expense,UPI
2026-11-13,Freelance Code Audit Bonus,8500,income,NetBanking
2026-11-12,Invalid Row Missing Amount,abc,expense,UPI
2026-11-11,Zepto Late Night Snacks,620,expense,UPI`;
