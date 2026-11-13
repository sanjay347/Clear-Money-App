import { CategorizerOutput } from '../types';

// ─── Rule table ───────────────────────────────────────────────────────────────
// Each rule is a regex tested against the uppercased transaction description.
// Order matters — first match wins.
//
// Coverage goal: resolve the common, unambiguous merchants without touching the AI.
//
// Patterns for short names use \b word boundaries. Without them /hbo/ matched
// "FISHBONE", /rent/ matched "RENTAL" and /adp/ matched "ROADPASS".

interface Rule {
  pattern: RegExp;
  category: CategorizerOutput['category'];
  merchant_clean?: string; // override if the regex alone doesn't produce a clean name
  is_subscription?: boolean;
  is_recurring?: boolean;
  only?: 'debit' | 'credit'; // rule applies only to this side of the ledger
}

const RULES: Rule[] = [
  // ── Income ────────────────────────────────────────────────────────────────
  { pattern: /direct\s*deposit/i,       category: 'Income', is_recurring: true, only: 'credit' },
  { pattern: /payroll/i,                category: 'Income', is_recurring: true, only: 'credit' },
  { pattern: /\b(gusto|adp|paychex|workday)\b/i, category: 'Income', is_recurring: true, only: 'credit' },
  { pattern: /tax\s*refund|irs\s*treas/i,  category: 'Income', only: 'credit' },
  { pattern: /zelle\s*from|venmo\s*from/i, category: 'Income', only: 'credit' },

  // ── Transfers ─────────────────────────────────────────────────────────────
  { pattern: /zelle\s*(to|payment)/i,   category: 'Transfer' },
  { pattern: /venmo/i,                  category: 'Transfer' },
  { pattern: /paypal/i,                 category: 'Transfer' },
  { pattern: /cash\s*app/i,             category: 'Transfer' },
  { pattern: /transfer\s*(to|from)/i,   category: 'Transfer' },
  { pattern: /\bwire\b/i,               category: 'Transfer' },

  // ── Subscriptions ─────────────────────────────────────────────────────────
  { pattern: /netflix/i,       category: 'Subscriptions', merchant_clean: 'Netflix',       is_subscription: true, is_recurring: true },
  { pattern: /spotify/i,       category: 'Subscriptions', merchant_clean: 'Spotify',       is_subscription: true, is_recurring: true },
  { pattern: /hulu/i,          category: 'Subscriptions', merchant_clean: 'Hulu',          is_subscription: true, is_recurring: true },
  { pattern: /disney\+|disney plus|disneyplus/i, category: 'Subscriptions', merchant_clean: 'Disney+', is_subscription: true, is_recurring: true },
  { pattern: /\bhbo\b|\bmax\.com/i, category: 'Subscriptions', merchant_clean: 'HBO Max', is_subscription: true, is_recurring: true },
  { pattern: /apple\.com\/bill|apple\s*one|apple\s*tv|itunes/i, category: 'Subscriptions', merchant_clean: 'Apple', is_subscription: true, is_recurring: true },
  { pattern: /google\s*(one|play|storage)/i, category: 'Subscriptions', merchant_clean: 'Google', is_subscription: true, is_recurring: true },
  { pattern: /amazon\s*prime/i,  category: 'Subscriptions', merchant_clean: 'Amazon Prime', is_subscription: true, is_recurring: true },
  { pattern: /youtube\s*premium/i, category: 'Subscriptions', merchant_clean: 'YouTube Premium', is_subscription: true, is_recurring: true },
  { pattern: /paramount\+|paramountplus/i, category: 'Subscriptions', merchant_clean: 'Paramount+', is_subscription: true, is_recurring: true },
  { pattern: /peacock/i,       category: 'Subscriptions', merchant_clean: 'Peacock',       is_subscription: true, is_recurring: true },
  { pattern: /duolingo/i,      category: 'Subscriptions', merchant_clean: 'Duolingo',      is_subscription: true, is_recurring: true },
  { pattern: /chatgpt|openai/i, category: 'Subscriptions', merchant_clean: 'OpenAI',       is_subscription: true, is_recurring: true },
  { pattern: /microsoft\s*(365|office)|xbox\s*(game\s*pass|live)/i, category: 'Subscriptions', merchant_clean: 'Microsoft', is_subscription: true, is_recurring: true },
  { pattern: /adobe/i,         category: 'Subscriptions', merchant_clean: 'Adobe',         is_subscription: true, is_recurring: true },
  { pattern: /dropbox/i,       category: 'Subscriptions', merchant_clean: 'Dropbox',       is_subscription: true, is_recurring: true },
  { pattern: /nordvpn|expressvpn|surfshark/i, category: 'Subscriptions',                   is_subscription: true, is_recurring: true },
  { pattern: /audible/i,       category: 'Subscriptions', merchant_clean: 'Audible',       is_subscription: true, is_recurring: true },
  { pattern: /kindle\s*unlimited/i, category: 'Subscriptions', merchant_clean: 'Kindle Unlimited', is_subscription: true, is_recurring: true },
  { pattern: /nytimes|new york times/i, category: 'Subscriptions',                         is_subscription: true, is_recurring: true },
  { pattern: /github/i,        category: 'Subscriptions', merchant_clean: 'GitHub',        is_subscription: true, is_recurring: true },
  { pattern: /\bnotion\b/i,        category: 'Subscriptions', merchant_clean: 'Notion',        is_subscription: true, is_recurring: true },
  { pattern: /1password|lastpass/i, category: 'Subscriptions',                             is_subscription: true, is_recurring: true },
  { pattern: /peloton/i,       category: 'Subscriptions', merchant_clean: 'Peloton',       is_subscription: true, is_recurring: true },

  // ── Bills & Utilities ─────────────────────────────────────────────────────
  { pattern: /at&t|verizon|t-mobile|sprint|comcast|xfinity|spectrum|cox\s*comm/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /\bcon\s*ed(ison)?\b|pg&e|\bpge\b|\bpseg\b|dominion\s*energy|duke\s*energy|\bfpl\b|national\s*grid/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /electric|gas\s*company|water\s*dept|sewage|utility/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /allstate|geico|state\s*farm|progressive\s*ins|liberty\s*mutual|nationwide\s*ins/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /\brent\b(?!\s*-?\s*a\s*-?\s*car)|mortgage|hoa\s*fee|property\s*mgmt/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /student\s*loan|sallie\s*mae|navient|nelnet/i, category: 'Bills & Utilities', is_recurring: true },
  { pattern: /internet|broadband/i, category: 'Bills & Utilities', is_recurring: true },

  // ── Transportation ────────────────────────────────────────────────────────
  { pattern: /\buber\b(?!\s*eat)/i, category: 'Transportation', merchant_clean: 'Uber' },
  { pattern: /\blyft\b/i,           category: 'Transportation', merchant_clean: 'Lyft' },
  { pattern: /e-zpass|fastrak|sunpass|tollway|toll\s*road/i, category: 'Transportation', is_recurring: false },
  { pattern: /parking|parkmobile|sp\+\s*parking/i, category: 'Transportation' },
  { pattern: /\bmta\b|\bbart\b|cta\s*ventra|metro\s*card|clipper\s*card|\btransit\b/i, category: 'Transportation', is_recurring: true },
  { pattern: /\bshell\b|exxon|chevron|\bbp\b|\bmobil\b|sunoco|circle\s*k|\bwawa\b/i, category: 'Transportation' },
  { pattern: /\bgas\s*station|fuel\b/i, category: 'Transportation' },
  { pattern: /jiffy\s*lube|firestone|midas|autozone|o'reilly\s*auto/i, category: 'Transportation' },
  { pattern: /\bairlines?\b|southwest|\bdelta\b(?!\s*(dental|faucet))|united\s*air|american\s*air|jetblue|spirit\s*air|frontier\s*air/i, category: 'Travel' },

  // ── Food & Dining ─────────────────────────────────────────────────────────
  { pattern: /starbucks/i,          category: 'Food & Dining', merchant_clean: 'Starbucks' },
  { pattern: /dunkin/i,             category: 'Food & Dining', merchant_clean: "Dunkin'" },
  { pattern: /doordash/i,           category: 'Food & Dining', merchant_clean: 'DoorDash' },
  { pattern: /uber\s*eat/i,         category: 'Food & Dining', merchant_clean: 'Uber Eats' },
  { pattern: /grubhub/i,            category: 'Food & Dining', merchant_clean: 'Grubhub' },
  { pattern: /instacart/i,          category: 'Food & Dining', merchant_clean: 'Instacart' },
  { pattern: /chipotle/i,           category: 'Food & Dining', merchant_clean: 'Chipotle' },
  { pattern: /mcdonald|mcdonalds/i, category: 'Food & Dining', merchant_clean: "McDonald's" },
  { pattern: /subway\s*(restaurant|\d)/i, category: 'Food & Dining', merchant_clean: 'Subway' },
  { pattern: /chick.fil.a/i,        category: 'Food & Dining', merchant_clean: 'Chick-fil-A' },
  { pattern: /taco\s*bell/i,        category: 'Food & Dining', merchant_clean: 'Taco Bell' },
  { pattern: /wendy'?s/i,           category: 'Food & Dining', merchant_clean: "Wendy's" },
  { pattern: /burger\s*king/i,      category: 'Food & Dining', merchant_clean: 'Burger King' },
  { pattern: /panera/i,             category: 'Food & Dining', merchant_clean: 'Panera Bread' },
  { pattern: /domino'?s/i,          category: 'Food & Dining', merchant_clean: "Domino's" },
  { pattern: /pizza\s*hut/i,        category: 'Food & Dining', merchant_clean: 'Pizza Hut' },
  { pattern: /\bpanda\s*express/i,  category: 'Food & Dining', merchant_clean: 'Panda Express' },
  { pattern: /olive\s*garden/i,     category: 'Food & Dining', merchant_clean: 'Olive Garden' },
  { pattern: /applebee'?s/i,        category: 'Food & Dining', merchant_clean: "Applebee's" },
  { pattern: /five\s*guys/i,        category: 'Food & Dining', merchant_clean: 'Five Guys' },
  { pattern: /whole\s*foods/i,      category: 'Food & Dining', merchant_clean: 'Whole Foods' },
  { pattern: /trader\s*joe'?s/i,    category: 'Food & Dining', merchant_clean: "Trader Joe's" },
  { pattern: /kroger/i,             category: 'Food & Dining', merchant_clean: 'Kroger' },
  { pattern: /safeway/i,            category: 'Food & Dining', merchant_clean: 'Safeway' },
  { pattern: /publix/i,             category: 'Food & Dining', merchant_clean: 'Publix' },
  { pattern: /\baldi\b/i,               category: 'Food & Dining', merchant_clean: 'ALDI' },
  { pattern: /\bheb\b/i,            category: 'Food & Dining', merchant_clean: 'HEB' },
  { pattern: /\btst\*/i,            category: 'Food & Dining' }, // Toast (restaurant POS)
  // Square (SQ *) is deliberately absent: salons, market stalls and repair
  // shops use it as much as cafes do, so those go to the model.

  // ── Shopping ──────────────────────────────────────────────────────────────
  { pattern: /amazon(?!\s*prime|\s*web)/i, category: 'Shopping', merchant_clean: 'Amazon' },
  { pattern: /walmart(?!\s*grocery)/i,     category: 'Shopping', merchant_clean: 'Walmart' },
  { pattern: /\btarget\b/i,               category: 'Shopping', merchant_clean: 'Target' },
  { pattern: /costco(?!\s*gas)/i,         category: 'Shopping', merchant_clean: 'Costco' },
  { pattern: /best\s*buy/i,               category: 'Shopping', merchant_clean: 'Best Buy' },
  { pattern: /home\s*depot/i,             category: 'Shopping', merchant_clean: 'Home Depot' },
  { pattern: /lowe'?s/i,                  category: 'Shopping', merchant_clean: "Lowe's" },
  { pattern: /\bikea\b/i,                     category: 'Shopping', merchant_clean: 'IKEA' },
  { pattern: /macy'?s/i,                  category: 'Shopping', merchant_clean: "Macy's" },
  { pattern: /nordstrom(?!\s*rack)/i,     category: 'Shopping', merchant_clean: 'Nordstrom' },
  { pattern: /nordstrom\s*rack/i,         category: 'Shopping', merchant_clean: 'Nordstrom Rack' },
  { pattern: /tj\s*maxx/i,               category: 'Shopping', merchant_clean: 'TJ Maxx' },
  { pattern: /marshalls/i,               category: 'Shopping', merchant_clean: 'Marshalls' },
  { pattern: /ross\s*stores/i,           category: 'Shopping', merchant_clean: 'Ross' },
  { pattern: /h&m\b/i,                   category: 'Shopping', merchant_clean: 'H&M' },
  { pattern: /\bzara\b/i,                    category: 'Shopping', merchant_clean: 'Zara' },
  { pattern: /old\s*navy/i,             category: 'Shopping', merchant_clean: 'Old Navy' },
  { pattern: /\bgap\b/i,           category: 'Shopping', merchant_clean: 'Gap' },
  { pattern: /\bnike\b/i,                    category: 'Shopping', merchant_clean: 'Nike' },
  { pattern: /adidas/i,                  category: 'Shopping', merchant_clean: 'Adidas' },
  { pattern: /apple\s*store/i,          category: 'Shopping', merchant_clean: 'Apple Store' },
  { pattern: /\betsy\b/i,                    category: 'Shopping', merchant_clean: 'Etsy' },
  { pattern: /\bebay\b/i,                    category: 'Shopping', merchant_clean: 'eBay' },
  { pattern: /shein/i,                   category: 'Shopping', merchant_clean: 'Shein' },
  { pattern: /chewy/i,                   category: 'Shopping', merchant_clean: 'Chewy' },
  { pattern: /petco|petsmart/i,          category: 'Shopping' },
  { pattern: /\bcvs\b(?!\s*health\s*corp)/i, category: 'Shopping', merchant_clean: 'CVS' },
  { pattern: /walgreens/i,               category: 'Shopping', merchant_clean: 'Walgreens' },

  // ── Health & Fitness ──────────────────────────────────────────────────────
  { pattern: /planet\s*fitness/i,   category: 'Health & Fitness', merchant_clean: 'Planet Fitness', is_subscription: true, is_recurring: true },
  { pattern: /\bgold'?s\s*gym/i,    category: 'Health & Fitness', is_subscription: true, is_recurring: true },
  { pattern: /\b24\s*hour\s*fitness/i, category: 'Health & Fitness', is_subscription: true, is_recurring: true },
  { pattern: /equinox/i,            category: 'Health & Fitness', merchant_clean: 'Equinox', is_subscription: true, is_recurring: true },
  { pattern: /anytime\s*fitness/i,  category: 'Health & Fitness', is_subscription: true, is_recurring: true },
  { pattern: /la\s*fitness/i,       category: 'Health & Fitness', is_subscription: true, is_recurring: true },
  { pattern: /ymca/i,               category: 'Health & Fitness', merchant_clean: 'YMCA', is_subscription: true, is_recurring: true },
  { pattern: /cvs\s*health\s*corp|rite\s*aid/i, category: 'Health & Fitness' },
  { pattern: /pharmacy|rx\s*fill/i, category: 'Health & Fitness' },
  { pattern: /urgent\s*care|patient\s*pay|labcorp|quest\s*diag/i, category: 'Health & Fitness' },

  // ── Entertainment ─────────────────────────────────────────────────────────
  { pattern: /amc\s*(theatre|entertainment)/i, category: 'Entertainment', merchant_clean: 'AMC Theatres' },
  { pattern: /regal\s*(cin|entertain)/i,       category: 'Entertainment', merchant_clean: 'Regal Cinemas' },
  { pattern: /ticketmaster|stubhub|seatgeek/i, category: 'Entertainment' },
  { pattern: /\bsteam\s*(games|purchase)?\b|steampowered|playstation\s*network|\bpsn\b|xbox\s*microsoft/i, category: 'Entertainment' },
  { pattern: /twitch/i,         category: 'Entertainment', merchant_clean: 'Twitch' },
  { pattern: /bowling|topgolf|dave\s*&\s*buster/i, category: 'Entertainment' },

  // ── Travel ────────────────────────────────────────────────────────────────
  { pattern: /airbnb/i,         category: 'Travel', merchant_clean: 'Airbnb' },
  { pattern: /hilton|marriott|hyatt|\bihg\b|wyndham|holiday\s*inn|best\s*western/i, category: 'Travel' },
  { pattern: /expedia|booking\.com|hotels\.com|kayak|priceline/i, category: 'Travel' },
  { pattern: /rental\s*car|rent\s*-?\s*a\s*-?\s*car|\bhertz\b|\bavis\b|budget\s*car|national\s*car/i, category: 'Travel' },
];

// ─── Public API ───────────────────────────────────────────────────────────────

export interface RuleResult {
  category: string;
  merchant_clean: string;
  is_subscription: boolean;
  is_recurring: boolean;
}

/**
 * Returns a categorization result if a rule matches, or null if the
 * transaction is unknown and should be sent to the AI.
 *
 * Pass the transaction type when known: income rules only apply to credits,
 * so a purchase at a restaurant called Gusto is not filed as payroll.
 */
export function tryRuleCategorize(description: string, type?: 'debit' | 'credit'): RuleResult | null {
  for (const rule of RULES) {
    if (rule.only && type && rule.only !== type) continue;
    if (rule.pattern.test(description)) {
      return {
        category: rule.category,
        merchant_clean: rule.merchant_clean ?? cleanForDisplay(description),
        is_subscription: rule.is_subscription ?? false,
        is_recurring: rule.is_recurring ?? false,
      };
    }
  }
  return null;
}

function cleanForDisplay(desc: string): string {
  // Minimal clean: strip leading Square/Toast prefix, trim trailing numbers
  return desc
    .replace(/^(SQ\s*\*|TST\*|POS\s+|ACH\s+)/i, '')
    .replace(/\s+#?\d{5,}$/, '')
    .trim();
}
