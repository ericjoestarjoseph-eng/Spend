import { CategoryName, LearnedRule, TransactionType } from '../types/finance';

export interface ClassificationResult {
  category: CategoryName;
  confidence: number;
  needsReview: boolean;
  matchedSignals: string[];
}

interface KeywordRule {
  category: CategoryName;
  strong: string[];
  medium: string[];
  weak: string[];
}

const KEYWORD_CORPUS: KeywordRule[] = [
  {
    category: 'Food and Dining',
    strong: [
      'swiggy',
      'zomato',
      'blinkit',
      'zepto',
      'instamart',
      'bigbasket',
      'starbucks',
      'blue tokai',
      'third wave',
      'haldiram',
      'dominos',
      'pizza hut',
      'kfc',
      'mcdonald',
      'biryani',
      'chaayos',
      'dmart',
      'nature basket',
      'licious',
      'eatfit',
    ],
    medium: [
      'restaurant',
      'cafe',
      'coffee',
      'bakery',
      'canteen',
      'mess',
      'grocery',
      'groceries',
      'supermarket',
      'tiffin',
      'lunch',
      'dinner',
      'breakfast',
      'tea',
      'snacks',
      'sweet',
      'dairy',
      'fruits',
      'vegetables',
      'kitchen',
      'bistro',
      'dhaba',
    ],
    weak: ['food', 'meal', 'hotel', 'bar', 'drink', 'order'],
  },
  {
    category: 'Transportation',
    strong: [
      'uber',
      'ola',
      'rapido',
      'namma yatri',
      'blusmart',
      'metro',
      'dmrc',
      'bmrc',
      'fastag',
      'hpcl',
      'bpcl',
      'indian oil',
      'shell petrol',
      'yulu',
    ],
    medium: [
      'petrol',
      'diesel',
      'fuel',
      'cab',
      'auto',
      'rickshaw',
      'parking',
      'toll',
      'bus',
      'commute',
      'pass',
      'tyre',
      'servicing',
      'bike',
    ],
    weak: ['ride', 'trip', 'transport', 'station'],
  },
  {
    category: 'Shopping',
    strong: [
      'amazon',
      'flipkart',
      'myntra',
      'ajio',
      'nykaa',
      'croma',
      'reliance digital',
      'decathlon',
      'ikea',
      'uniqlo',
      'zara',
      'h&m',
      'meesho',
      'tatacliq',
      'apple store',
      'lenskart',
    ],
    medium: [
      'apparel',
      'clothing',
      'shoes',
      'sneakers',
      'electronics',
      'laptop',
      'headphones',
      'watch',
      'bag',
      'furniture',
      'home decor',
      'accessories',
      'gift',
      'mall',
      'store',
    ],
    weak: ['buy', 'shop', 'retail', 'mart', 'purchase'],
  },
  {
    category: 'Entertainment',
    strong: [
      'netflix',
      'spotify',
      'prime video',
      'hotstar',
      'jio cinema',
      'bookmyshow',
      'pvr',
      'inox',
      'youtube premium',
      'playstation',
      'steam',
      'sony liv',
      'zee5',
    ],
    medium: [
      'cinema',
      'movie',
      'concert',
      'theatre',
      'gaming',
      'subscription',
      'music',
      'bowling',
      'arcade',
      'comedy',
      'match ticket',
      'festival',
    ],
    weak: ['stream', 'show', 'club', 'event', 'fun'],
  },
  {
    category: 'Healthcare',
    strong: [
      'apollo pharmacy',
      'pharmeasy',
      '1mg',
      'tata 1mg',
      'netmeds',
      'practo',
      'medplus',
      'manipal hospital',
      'fortis',
      'max healthcare',
      'thyrocare',
      'dr lal pathlabs',
    ],
    medium: [
      'pharmacy',
      'medical',
      'clinic',
      'hospital',
      'doctor',
      'dental',
      'dentist',
      'diagnostic',
      'lab test',
      'blood test',
      'medicine',
      'consultation',
      'eye checkup',
      'physiotherapy',
    ],
    weak: ['health', 'care', 'rx', 'tablet'],
  },
  {
    category: 'Education',
    strong: [
      'coursera',
      'udemy',
      'edx',
      'unacademy',
      'byjus',
      'physicswallah',
      'upgrad',
      'scaler',
      'oreilly',
      'kindle',
      'crossword',
      'sapna book',
      'notion',
      'github',
    ],
    medium: [
      'tuition',
      'semester',
      'college',
      'university',
      'exam fee',
      'course',
      'workshop',
      'textbook',
      'stationery',
      'notebook',
      'library',
      'certification',
      'photocopy',
      'printout',
    ],
    weak: ['study', 'book', 'learn', 'class', 'fee'],
  },
  {
    category: 'Bills and Utilities',
    strong: [
      'airtel',
      'jio',
      'jiofiber',
      'act fibernet',
      'vi postpaid',
      'bsnl',
      'bescom',
      'tata power',
      'adani electricity',
      'mahavitaran',
      'indane',
      'hp gas',
      'bharat gas',
      'bwssb',
      'cred bill',
    ],
    medium: [
      'electricity',
      'broadband',
      'wifi',
      'internet',
      'recharge',
      'mobile bill',
      'postpaid',
      'water bill',
      'gas cylinder',
      'piped gas',
      'dth',
      'utility',
      'bill pay',
    ],
    weak: ['bill', 'power', 'recharge', 'plan'],
  },
  {
    category: 'Housing',
    strong: [
      'nobroker',
      'mygate',
      'nestaway',
      'stanza living',
      'zolo stays',
      'urban company',
    ],
    medium: [
      'rent',
      'house rent',
      'flat rent',
      'hostel fee',
      'pg rent',
      'maintenance',
      'society',
      'deposit',
      'plumber',
      'electrician',
      'housekeeping',
      'maid',
      'cook salary',
      'landlord',
    ],
    weak: ['apartment', 'flat', 'room', 'repair'],
  },
  {
    category: 'Travel',
    strong: [
      'indigo',
      'air india',
      'vistara',
      'akasa air',
      'makemytrip',
      'goibibo',
      'irctc',
      'redbus',
      'cleartrip',
      'airbnb',
      'oyo',
      'taj hotels',
      'treebo',
      'zostel',
    ],
    medium: [
      'flight',
      'airfare',
      'train ticket',
      'sleeper bus',
      'hotel stay',
      'resort',
      'homestay',
      'luggage',
      'visa',
      'boarding',
      'vacation',
      'weekend getaway',
    ],
    weak: ['booking', 'stay', 'tour', 'travel'],
  },
  {
    category: 'Personal Care',
    strong: [
      'cult.fit',
      'cultfit',
      'gold gym',
      'anytime fitness',
      'toni & guy',
      'looks salon',
      'naturals salon',
      'kama ayurveda',
      'forest essentials',
    ],
    medium: [
      'salon',
      'haircut',
      'grooming',
      'barber',
      'spa',
      'gym',
      'fitness',
      'yoga',
      'skincare',
      'laundry',
      'dry clean',
      'cosmetics',
    ],
    weak: ['wellness', 'trim', 'wash'],
  },
  {
    category: 'Income',
    strong: [
      'salary',
      'payroll',
      'stipend',
      'freelance payout',
      'pocket money',
      'allowance',
      'dividend',
      'tax refund',
    ],
    medium: [
      'credited',
      'neft cr',
      'imps cr',
      'reimbursement',
      'cashback',
      'interest',
      'bonus',
      'consulting fee',
      'invoice paid',
    ],
    weak: ['refund', 'payout', 'credit', 'received'],
  },
];

export function normalizeMerchantText(text: string): string {
  return text
    .toLowerCase()
    .replace(/upi\/[0-9]+\//g, ' ')
    .replace(/[^a-z0-9\s.&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyTransaction(
  description: string,
  type: TransactionType,
  learnedRules: LearnedRule[] = []
): ClassificationResult {
  if (type === 'income') {
    const norm = normalizeMerchantText(description);
    const incomeRule = KEYWORD_CORPUS.find((k) => k.category === 'Income');
    const matched = incomeRule
      ? [...incomeRule.strong, ...incomeRule.medium].filter((kw) => norm.includes(kw))
      : [];
    return {
      category: 'Income',
      confidence: matched.length > 0 ? 0.96 : 0.88,
      needsReview: false,
      matchedSignals: matched.length > 0 ? matched : ['income transaction type'],
    };
  }

  const normalized = normalizeMerchantText(description);
  if (!normalized) {
    return {
      category: 'Other',
      confidence: 0.42,
      needsReview: true,
      matchedSignals: [],
    };
  }

  // 1. Check user-corrected learned merchant rules first
  for (const rule of learnedRules) {
    const patternNorm = normalizeMerchantText(rule.pattern);
    if (patternNorm.length >= 3 && normalized.includes(patternNorm)) {
      return {
        category: rule.category,
        confidence: 0.97,
        needsReview: false,
        matchedSignals: [`learned: "${rule.pattern}"`],
      };
    }
  }

  // 2. Weighted token / phrase scoring (TF-IDF-inspired heuristic classifier)
  const scores: Array<{
    category: CategoryName;
    score: number;
    signals: string[];
  }> = [];

  for (const rule of KEYWORD_CORPUS) {
    if (rule.category === 'Income') continue;
    let score = 0;
    const signals: string[] = [];

    for (const kw of rule.strong) {
      if (normalized.includes(kw)) {
        score += 3.2;
        signals.push(kw);
      }
    }
    for (const kw of rule.medium) {
      if (normalized.includes(kw)) {
        score += 1.9;
        signals.push(kw);
      }
    }
    for (const kw of rule.weak) {
      if (normalized.includes(kw)) {
        score += 0.75;
        signals.push(kw);
      }
    }

    if (score > 0) {
      scores.push({ category: rule.category, score, signals });
    }
  }

  if (scores.length === 0) {
    return {
      category: 'Other',
      confidence: 0.48,
      needsReview: true,
      matchedSignals: ['ambiguous description'],
    };
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const runnerUp = scores[1];

  const margin = runnerUp ? top.score - runnerUp.score : top.score;
  let confidence = 0.62 + Math.min(top.score, 5) * 0.055 + Math.min(margin, 2) * 0.035;
  confidence = Math.min(0.98, Math.max(0.52, Number(confidence.toFixed(2))));

  const needsReview = confidence < 0.75;

  return {
    category: top.category,
    confidence,
    needsReview,
    matchedSignals: top.signals.slice(0, 3),
  };
}

export function extractMerchantPattern(description: string): string {
  const cleaned = normalizeMerchantText(description)
    .replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/g, '')
    .replace(/\b\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter((w) => w.length > 2);
  return words.slice(0, 3).join(' ');
}
