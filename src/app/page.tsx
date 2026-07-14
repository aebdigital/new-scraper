"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  RefreshCw,
  Globe,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Building,
  AlertCircle,
  Swords,
  Users,
  Eye,
  TrendingUp,
  Sprout,
  Hammer,
  Factory,
  Zap,
  Droplets,
  HardHat,
  ShoppingCart,
  Truck,
  Coffee,
  Code,
  Coins,
  Home,
  FlaskConical,
  Briefcase,
  Landmark,
  GraduationCap,
  HeartPulse,
  Heart,
  Star,
  Palette,
  Wrench,
  Pencil,
  CalendarDays,
  Trash2
} from "lucide-react";

interface Company {
  id: number;
  name: string;
  city: string | null;
  website: string | null;
  domain: string | null;
  phone: string | null;
  address: string | null;
  emailsFound: string | null;
  leadScore: number;
  status: string;
  lastCrawledAt: number | null;
  revenue: number | null;
  profit: number | null;
  assets: number | null;
  financialYear: number | null;
  finstatRank: number | null;
  nace: string | null;
  naceSection: string | null;
  naceDivision: string | null;
  naceSubdivision: string | null;
  legalFormCode: string | null;
  commCount?: number;
  hasWarning?: number | boolean;
  hasNextDayLead?: number | boolean;
  hasBrokenWebsiteLead?: number | boolean;
  hasNewWebsiteTag?: number | boolean;
  hasNewSiteComingTag?: number | boolean;
  hasNoWebsiteTag?: number | boolean;
  financialHistory?: string | null;
  lastCalledAt?: number | null;
  lastCalledNote?: string | null;
  lastEmailedAt?: number | null;
  lastEmailedNote?: string | null;
}

interface Stats {
  total: number;
  pending: number;
  crawled: number;
  dead: number;
  live: number;
  redirect: number;
  scoring: {
    hot: number;
    warm: number;
    low: number;
  };
  technologies: Record<string, number>;
  topCities: { name: string; count: number }[];
}

interface Rival {
  id: number;
  name: string;
  website: string | null;
  domain: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  totalClients: number;
  constructionClients: number;
  portfolioUrl: string | null;
  status: string;
  firstSeen: number | null;
  lastCheckedAt: number | null;
}

interface RivalClient {
  linkId: number;
  detectionMethod: string;
  confidenceScore: number;
  firstDetectedAt: number | null;
  lastConfirmedAt: number | null;
  companyId: number;
  companyName: string;
  companyDomain: string | null;
  companyWebsite: string | null;
  companyCity: string | null;
  companyRevenue: number | null;
  companyProfit: number | null;
  companyNace: string | null;
  companyNaceSection: string | null;
  companyLegalFormCode: string | null;
}

const NACE_SECTIONS = [
  { code: "A", name: "Poľnohospodárstvo, lesníctvo a rybolov" },
  { code: "B", name: "Ťažba a dobývanie" },
  { code: "C", name: "Priemyselná výroba" },
  { code: "D", name: "Dodávka elektriny, plynu, pary" },
  { code: "E", name: "Dodávka vody, odpady" },
  { code: "F", name: "Stavebníctvo" },
  { code: "G", name: "Veľkoobchod a maloobchod" },
  { code: "H", name: "Doprava a skladovanie" },
  { code: "I", name: "Ubytovacie a stravovacie služby" },
  { code: "J", name: "Informácie a komunikácia" },
  { code: "K", name: "Finančné a poisťovacie činnosti" },
  { code: "L", name: "Činnosti v obl. nehnuteľností" },
  { code: "M", name: "Odborné, vedecké a technické činnosti" },
  { code: "N", name: "Administratívne a podporné služby" },
  { code: "O", name: "Verejná správa a obrana" },
  { code: "P", name: "Vzdelávanie" },
  { code: "Q", name: "Zdravotníctvo a sociálna pomoc" },
  { code: "R", name: "Umenie, zábava a rekreácia" },
  { code: "S", name: "Ostatné činnosti" },
  { code: "T", name: "Činnosti domácností" },
  { code: "U", name: "Extrateritoriálne organizácie" }
];

const NACE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  A: Sprout,
  B: Hammer,
  C: Factory,
  D: Zap,
  E: Droplets,
  F: HardHat,
  G: ShoppingCart,
  H: Truck,
  I: Coffee,
  J: Code,
  K: Coins,
  L: Home,
  M: FlaskConical,
  N: Briefcase,
  O: Landmark,
  P: GraduationCap,
  Q: HeartPulse,
  R: Palette,
  S: Wrench,
  T: Users,
  U: Globe,
};

const NACE_DIVISIONS_SK: Record<string, string> = {
  "01": "Pestovanie plodín, chov zvierat",
  "02": "Lesníctvo a ťažba dreva",
  "03": "Rybolov a akvakultúra",
  "05": "Ťažba uhlia a lignitu",
  "06": "Ťažba ropy a zemného plynu",
  "07": "Ťažba kovových rúd",
  "08": "Iná ťažba a dobývanie",
  "09": "Pomocné služby pri ťažbe",
  "10": "Výroba potravín",
  "11": "Výroba nápojov",
  "12": "Výroba tabakových výrobkov",
  "13": "Výroba textilu",
  "14": "Výroba odevov",
  "15": "Výroba kože a kožených výrobkov",
  "16": "Spracovanie dreva, výrobky z dreva",
  "17": "Výroba papiera a papierových výrobkov",
  "18": "Tlač a reprodukcia médií",
  "19": "Výroba koksu a rafinovaných ropných produktov",
  "20": "Výroba chemikálií a chemických produktov",
  "21": "Výroba farmaceutických výrobkov",
  "22": "Výroba výrobkov z gumy a plastu",
  "23": "Výroba ostatných nekovových minerálnych výrobkov",
  "24": "Výroba kovov",
  "25": "Výroba kovových konštrukcií okrem strojov",
  "26": "Výroba počítačových, elektronických výrobkov",
  "27": "Výroba elektrických zariadení",
  "28": "Výroba strojov a zariadení i.n.",
  "29": "Výroba motorových vozidiel, návesov",
  "30": "Výroba ostatných dopravných prostriedkov",
  "31": "Výroba nábytku",
  "32": "Iná výroba",
  "33": "Oprava a inštalácia strojov a prístrojov",
  "35": "Dodávka elektriny, plynu, pary",
  "36": "Zber, úprava a dodávka vody",
  "37": "Čistenie odpadových vôd",
  "38": "Zber, spracovanie a likvidácia odpadov",
  "39": "Sanácia a ostatné služby odpadov",
  "41": "Výstavba budov",
  "42": "Inžinierske stavby",
  "43": "Špecializované stavebné práce",
  "45": "Veľkoobchod, maloobchod a oprava vozidiel",
  "46": "Veľkoobchod okrem motorových vozidiel",
  "47": "Maloobchod okrem motorových vozidiel",
  "49": "Pozemná doprava a potrubná doprava",
  "50": "Vodná doprava",
  "51": "Letecká doprava",
  "52": "Skladové a pomocné činnosti v doprave",
  "53": "Poštové služby a služby kuriérov",
  "55": "Ubytovanie",
  "56": "Činnosti reštaurácií a pohostinstiev",
  "58": "Nakladateľské činnosti",
  "59": "Výroba filmov, videozáznamov, TV programov",
  "60": "Tvorba programov a vysielanie",
  "61": "Telekomunikácie",
  "62": "Počítačové programovanie, poradenstvo",
  "63": "Informačné služby",
  "64": "Finančné služby okrem poisťovníctva",
  "65": "Poisťovanie, zaistenie, dôchodkové zabezpečenie",
  "66": "Pomocné činnosti finančných služieb a poisťovníctva",
  "68": "Činnosti v oblasti nehnuteľností",
  "69": "Právne a účtovnícke činnosti",
  "70": "Vedenie firiem, poradenstvo v oblasti riadenia",
  "71": "Architektonické a inžinierske činnosti",
  "72": "Vedecký výskum a vývoj",
  "73": "Reklama a prieskum trhu",
  "74": "Ostatné odborné, vedecké a technické činnosti",
  "75": "Veterinárne činnosti",
  "77": "Prenájom a lízing",
  "78": "Sprostredkovanie práce",
  "79": "Cestovné kancelárie, rezervácie",
  "80": "Bezpečnostné a pátracie služby",
  "81": "Činnosti súvisiace s údržbou zariadení a krajiny",
  "82": "Administratívne, pomocné kancelárske činnosti",
  "84": "Verejná správa, obrana, sociálne zabezpečenie",
  "85": "Vzdelávanie",
  "86": "Zdravotníctvo",
  "87": "Sociálna starostlivosť v pobytových zariadeniach",
  "88": "Sociálna pomoc bez ubytovania",
  "90": "Tvorivé, umelecké a zábavné činnosti",
  "91": "Činnosti knižníc, archívov, múzeí",
  "92": "Činnosti herní a stávkových kancelárií",
  "93": "Športové, zábavné a rekreačné činnosti",
  "94": "Činnosti členských organizácií",
  "95": "Oprava počítačov, potrieb pre domácnosť",
  "96": "Ostatné osobné služby",
  "99": "Činnosti extrateritoriálnych organizácií",
};

const NACE_SUBDIVISIONS: Record<string, { code: string; name: string }[]> = {
  "41": [
    { code: "41100", name: "41.100 - Development of building projects" },
    { code: "41200", name: "41.200 - Construction of residential/non-residential buildings" }
  ],
  "42": [
    { code: "42110", name: "42.110 - Construction of roads and motorways" },
    { code: "42120", name: "42.120 - Construction of railways and underground railways" },
    { code: "42130", name: "42.130 - Construction of bridges and tunnels" },
    { code: "42210", name: "42.210 - Construction of utility projects for fluids" },
    { code: "42220", name: "42.220 - Construction of utility projects for electricity & telecommunications" },
    { code: "42910", name: "42.910 - Construction of water projects" },
    { code: "42990", name: "42.990 - Construction of other civil engineering projects n.e.c." }
  ],
  "43": [
    { code: "43110", name: "43.110 - Demolition" },
    { code: "43120", name: "43.120 - Site preparation" },
    { code: "43130", name: "43.130 - Test drilling and boring" },
    { code: "43210", name: "43.210 - Electrical installation (Elektroinštalácie)" },
    { code: "43220", name: "43.220 - Plumbing, heat and air-conditioning (Vodoinštalácie, kúrenie)" },
    { code: "43290", name: "43.290 - Other construction installation" },
    { code: "43310", name: "43.310 - Plastering" },
    { code: "43320", name: "43.320 - Joinery installation" },
    { code: "43330", name: "43.330 - Floor and wall covering" },
    { code: "43340", name: "43.340 - Painting and glazing" },
    { code: "43390", name: "43.390 - Other building completion and finishing" },
    { code: "43910", name: "43.910 - Roofing activities" },
    { code: "43990", name: "43.990 - Other specialised construction activities n.e.c." }
  ]
};

const SECTION_TO_DIVISIONS: Record<string, string[]> = {
  A: ["01", "02", "03"],
  B: ["05", "06", "07", "08", "09"],
  C: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"],
  D: ["35"],
  E: ["36", "37", "38", "39"],
  F: ["41", "42", "43"],
  G: ["45", "46", "47"],
  H: ["49", "50", "51", "52", "53"],
  I: ["55", "56"],
  J: ["58", "59", "60", "61", "62", "63"],
  K: ["64", "65", "66"],
  L: ["68"],
  M: ["69", "70", "71", "72", "73", "74", "75"],
  N: ["77", "78", "79", "80", "81", "82"],
  O: ["84"],
  P: ["85"],
  Q: ["86", "87", "88"],
  R: ["90", "91", "92", "93"],
  S: ["94", "95", "96"],
  T: ["97", "98"],
  U: ["99"]
};

const getDivisionsForSection = (section: string) => {
  const codes = SECTION_TO_DIVISIONS[section] || [];
  return codes.map(code => ({
    code,
    name: `${code} - ${NACE_DIVISIONS_SK[code] || "Neznáma divízia"}`
  }));
};

const getNaceDescription = (code: string | null) => {
  if (!code) return "";
  
  if (code.length === 5) {
    for (const div in NACE_SUBDIVISIONS) {
      const sub = NACE_SUBDIVISIONS[div].find(s => s.code === code);
      if (sub) return sub.name;
    }
    const formatted = `${code.substring(0, 2)}.${code.substring(2)}`;
    const divName = NACE_DIVISIONS_SK[code.substring(0, 2)];
    return divName ? `${formatted} (Pod ${divName})` : formatted;
  }
  
  if (code.length === 2) {
    const name = NACE_DIVISIONS_SK[code];
    if (name) return `${code} - ${name}`;
  }
  
  const sec = NACE_SECTIONS.find(s => s.code === code);
  if (sec) return `${sec.code} - ${sec.name}`;
  
  return code;
};

const cleanCrmLogNote = (note: string | null | undefined) =>
  (note || "")
    .replace(/^\[(REMIND|NOANSWER|INTEREST|DECLINE|WARNING)\]\s*/i, "")
    .replace(/^Nový záujem – poslať mail$/i, "")
    .trim();

const getCrmOutcome = (note: string | null | undefined) => {
  const text = (note || "").trim().toLowerCase();
  if (!text) return null;
  if (text.startsWith("[crm:remind]") || text.startsWith("[remind]") || text.includes("zavolať znova") || text.includes("pripomenúť ďalší deň")) return "remind";
  if (text.startsWith("[crm:noanswer]") || text.startsWith("[noanswer]") || text.includes("nezdvihol")) return "noanswer";
  if (text.startsWith("[crm:interest]") || text.startsWith("[interest]") || text.includes("nový záujem")) return "interest";
  if (text.startsWith("[crm:decline]") || text.startsWith("[decline]") || text.includes("odmietol") || text.includes("decline")) return "decline";
  if (text.startsWith("[crm:warning]") || text.startsWith("[warning]") || text.includes("nepríjem") || text.includes("neprijem") || text.includes("warning")) return "warning";
  return null;
};

const getTomorrowDateValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toLocalDateValue(tomorrow);
};

const toLocalDateValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const toLocalDateTimeValue = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${toLocalDateValue(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatReminderDate = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatCompactSkDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "numeric",
  });

const getReminderTimestamp = (dateValue: string, fallbackTimestamp = Date.now()) => {
  const fallbackDate = new Date(fallbackTimestamp);
  const date = new Date(`${dateValue}T${String(fallbackDate.getHours()).padStart(2, "0")}:${String(fallbackDate.getMinutes()).padStart(2, "0")}:00`);
  return Number.isNaN(date.getTime()) ? fallbackTimestamp : date.getTime();
};

const parseReminderOriginalCallDate = (note: string | null | undefined) => {
  const text = cleanCrmLogNote(note);
  const match = text.match(/mal som sa ozvať,?\s*volali sme\s*(\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{4})?)/i);
  return match ? match[1].trim() : "";
};

const parseCompactSkDateValue = (dateText: string, fallbackDateValue = toLocalDateValue(new Date())) => {
  const fallbackYear = Number(fallbackDateValue.slice(0, 4)) || new Date().getFullYear();
  const match = dateText.match(/(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*(\d{4}))?/);
  if (!match) return "";
  const [, day, month, year] = match;
  return `${year || fallbackYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const parseReminderDateValue = (note: string | null | undefined) => {
  const text = cleanCrmLogNote(note);
  const skDate = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (skDate) {
    const [, day, month, year] = skDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const isoDate = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  return isoDate ? isoDate[0] : "";
};

const parseReminderNoteText = (note: string | null | undefined) => {
  let text = cleanCrmLogNote(note)
    .replace(/^Pripomenúť:\s*/i, "")
    .trim();

  let previous = "";
  while (text !== previous) {
    previous = text;
    text = text
      .replace(/^Pripomenúť:\s*/i, "")
      .replace(/mal som sa ozvať,?\s*volali sme\s*\d{1,2}\.\s*\d{1,2}\.?(?:\s*\d{4})?\s*[-–—|:]?\s*/i, "")
      .replace(/\d{1,2}\.\s*\d{1,2}\.\s*\d{4}\s*[-–—|:]?\s*/g, "")
      .replace(/\d{4}-\d{2}-\d{2}\s*[-–—|:]?\s*/g, "")
      .trim();
  }

  return text;
};

const buildReminderNote = (
  dateValue: string,
  noteText = "",
  originalCall?: number | string
) => {
  const note = parseReminderNoteText(noteText);
  const originalCallLabel =
    typeof originalCall === "number"
      ? formatCompactSkDate(originalCall)
      : originalCall;
  const originalText = originalCallLabel ? `Mal som sa ozvať, volali sme ${originalCallLabel}` : "";
  return [formatReminderDate(dateValue), originalText, note]
    .filter(Boolean)
    .reduce((value, part, index) => (index === 0 ? `Pripomenúť: ${part}` : `${value} – ${part}`), "");
};

function ReminderDatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewMonth, setViewMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    if (value) {
      const nextDate = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(nextDate.getTime())) {
        setViewMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
      }
    }
  }, [value]);

  const monthLabel = viewMonth.toLocaleDateString("sk-SK", {
    month: "long",
    year: "numeric",
  });
  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const offset = (monthStart.getDay() + 6) % 7;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - offset);
  const selectedValue = value;

  return (
    <div
      className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-amber-400/30 bg-slate-950 shadow-2xl shadow-black/40 p-2 z-[70]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
          aria-label="Predchádzajúci mesiac"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-bold text-slate-100 capitalize">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
          className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white"
          aria-label="Ďalší mesiac"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 mb-1">
        {["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }, (_, idx) => {
          const date = new Date(gridStart);
          date.setDate(gridStart.getDate() + idx);
          const dateValue = toLocalDateValue(date);
          const inMonth = date.getMonth() === viewMonth.getMonth();
          const selected = dateValue === selectedValue;
          return (
            <button
              key={dateValue}
              type="button"
              onClick={() => onChange(dateValue)}
              className={`h-7 rounded text-xs font-semibold transition ${
                selected
                  ? "bg-amber-400 text-slate-950"
                  : inMonth
                  ? "text-slate-200 hover:bg-amber-400/20 hover:text-amber-100"
                  : "text-slate-700 hover:bg-white/5"
              }`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniLineChart({
  title,
  subtitle,
  categories,
  values,
  color = "#39bf87",
}: {
  title: string;
  subtitle: string;
  categories: string[];
  values: number[];
  color?: string;
}) {
  if (!categories || !values || categories.length === 0 || values.length === 0) {
    return null;
  }

  // Format utility
  const formatMoney = (val: number | null) => {
    if (val === null || val === undefined) return "-";
    if (Math.abs(val) >= 1000000) {
      return `${(val / 1000000).toFixed(1)}M €`;
    }
    return `${val.toLocaleString("sk-SK")} €`;
  };

  // Dimensions of SVG
  const width = 450;
  const height = 180;

  // Padding
  const paddingLeft = 45;
  const paddingRight = 45;
  const paddingTop = 40;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find min and max for scaling
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const valueRange = maxVal - minVal || 1;

  // Helper to map values to coordinates
  const getX = (index: number) => {
    if (values.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (index / (values.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / valueRange;
    return height - paddingBottom - ratio * chartHeight;
  };

  // Build the line path
  const points = values.map((val, idx) => ({ x: getX(idx), y: getY(val) }));

  let linePath = "";
  let areaPath = "";

  if (points.length > 0) {
    linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");

    // For area path, go down to the minVal level (which represents the baseline)
    const baselineY = getY(0);
    areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;
  }

  return (
    <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col w-full select-none">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-xs font-bold text-slate-400 block">{title}</span>
          <span className="text-[10px] text-slate-500 block">{subtitle}</span>
        </div>
        <span className="text-[8px] tracking-wider text-slate-600 font-medium uppercase mt-0.5">FinStat.sk</span>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[180px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          {/* Gradients */}
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference baseline grid lines */}
          <line
            x1={paddingLeft}
            y1={getY(0)}
            x2={width - paddingRight}
            y2={getY(0)}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Vertical dashed lines for each year category */}
          {categories.map((cat, idx) => {
            const x = getX(idx);
            return (
              <line
                key={idx}
                x1={x}
                y1={paddingTop - 10}
                x2={x}
                y2={height - paddingBottom}
                stroke="rgba(255,255,255,0.04)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
            );
          })}

          {/* Area Fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill={`url(#grad-${title.replace(/\s+/g, "")})`}
              className="transition-all duration-300"
            />
          )}

          {/* Connected Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Dots and Value Labels */}
          {points.map((p, idx) => {
            const val = values[idx];
            const formatted = formatMoney(val);
            const isNegative = val < 0;

            return (
              <g key={idx} className="group cursor-pointer">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.5"
                  fill="#020617"
                  stroke={color}
                  strokeWidth="2.5"
                  className="transition-all duration-200 hover:r-6"
                />

                <text
                  x={p.x}
                  y={p.y - 12}
                  textAnchor="middle"
                  fill={isNegative ? "#f87171" : "#e2e8f0"}
                  className="text-[9px] font-bold select-none"
                >
                  {formatted}
                </text>
              </g>
            );
          })}

          {/* X Axis Year Labels */}
          {categories.map((cat, idx) => {
            const x = getX(idx);
            const displayCat = cat.replace(/\s*\[.*\]/g, "");
            return (
              <text
                key={idx}
                x={x}
                y={height - 10}
                textAnchor="middle"
                fill="#64748b"
                className="text-[10px] font-medium"
              >
                {displayCat}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function Dashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"companies" | "rivals" | "crm">("companies");

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Companies listing state
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [sortBy, setSortBy] = useState("revenue_desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [jumpPageInput, setJumpPageInput] = useState("1");

  // NACE & Legal Form filters state
  const [naceSection, setNaceSection] = useState("");
  const [naceDivision, setNaceDivision] = useState("");
  const [naceSubdivision, setNaceSubdivision] = useState("");
  const [legalForm, setLegalForm] = useState("sro");
  const [dynamicSubdivisions, setDynamicSubdivisions] = useState<string[]>([]);
  const [subdivisionsLoading, setSubdivisionsLoading] = useState(false);

  const handleSectionChange = (section: string) => {
    setNaceSection(section);
    setNaceDivision("");
    setNaceSubdivision("");
    setPage(1);
  };

  const handleDivisionChange = (division: string) => {
    setNaceDivision(division);
    setNaceSubdivision("");
    setPage(1);
  };

  const handleSubdivisionChange = (subdivision: string) => {
    setNaceSubdivision(subdivision);
    setPage(1);
  };

  // Selected company for detail modal
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [detailSnapshot, setDetailSnapshot] = useState<any | null>(null);
  const [detailEvents, setDetailEvents] = useState<any[]>([]);
  const [detailComms, setDetailComms] = useState<any[]>([]);
  const [expandedComm, setExpandedComm] = useState<number | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Inline website editing state
  const [editingWebsiteCompanyId, setEditingWebsiteCompanyId] = useState<number | null>(null);
  const [editingWebsiteValue, setEditingWebsiteValue] = useState("");

  // CRM daily logs state
  const [crmLogs, setCrmLogs] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [warningMenuCompanyId, setWarningMenuCompanyId] = useState<number | null>(null);

  // CRM inline logging states
  const [inlineLogCompanyId, setInlineLogCompanyId] = useState<number | null>(null);
  const [inlineLogType, setInlineLogType] = useState<"call" | "email" | null>(null);
  const [inlineLogNote, setInlineLogNote] = useState("");
  const [reminderDateCompanyId, setReminderDateCompanyId] = useState<number | null>(null);
  const [reminderDateValue, setReminderDateValue] = useState("");
  const [reminderNoteValue, setReminderNoteValue] = useState("");
  const [editingReminderLogId, setEditingReminderLogId] = useState<number | null>(null);
  const [openReminderCalendarLogId, setOpenReminderCalendarLogId] = useState<number | null>(null);
  const [editingReminderDateValue, setEditingReminderDateValue] = useState("");

  // CRM log note editing
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editingLogText, setEditingLogText] = useState("");
  const [editingLogTimeId, setEditingLogTimeId] = useState<number | null>(null);
  const [editingLogTimeValue, setEditingLogTimeValue] = useState("");

  // CRM call/email logging states
  const [callNote, setCallNote] = useState("");
  const [callDate, setCallDate] = useState("");
  const [emailNote, setEmailNote] = useState("");
  const [emailDate, setEmailDate] = useState("");
  const [isSavingLog, setIsSavingLog] = useState(false);

  // Crawling action state
  const [isCrawlingBatch, setIsCrawlingBatch] = useState(false);
  const [crawlProgressMessage, setCrawlProgressMessage] = useState("");
  const [isCrawlingSingle, setIsCrawlingSingle] = useState(false);

  // Rivals state
  const [rivalsData, setRivalsData] = useState<Rival[]>([]);
  const [rivalsLoading, setRivalsLoading] = useState(false);
  const [rivalsSearch, setRivalsSearch] = useState("");
  const [rivalsSortBy, setRivalsSortBy] = useState("clients_desc");
  const [rivalsPage, setRivalsPage] = useState(1);
  const [rivalsTotalPages, setRivalsTotalPages] = useState(1);
  const [rivalsTotalCount, setRivalsTotalCount] = useState(0);
  const [jumpRivalsPageInput, setJumpRivalsPageInput] = useState("1");
  const [selectedRivalId, setSelectedRivalId] = useState<number | null>(null);
  const [rivalDetail, setRivalDetail] = useState<Rival | null>(null);
  const [rivalClients, setRivalClients] = useState<RivalClient[]>([]);
  const [rivalDetailLoading, setRivalDetailLoading] = useState(false);

  // Fetch metrics
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSaveWebsite = async (companyId: number) => {
    const original = companies.find(c => c.id === companyId);
    if (!original) {
      setEditingWebsiteCompanyId(null);
      return;
    }

    const newVal = editingWebsiteValue.trim();
    if (newVal === (original.website || "")) {
      setEditingWebsiteCompanyId(null);
      return;
    }

    try {
      // Optimistically update local UI state
      setCompanies(prev => prev.map(c => {
        if (c.id === companyId) {
          let domain = null;
          if (newVal) {
            try {
              const url = newVal.startsWith("http") ? newVal : `https://${newVal}`;
              const parsed = new URL(url);
              domain = parsed.hostname.toLowerCase();
              if (domain.startsWith("www.")) domain = domain.substring(4);
            } catch (e) {
              domain = newVal.toLowerCase().replace(/https?:\/\/(www\.)?/, "");
            }
          }
          return { ...c, website: newVal || null, domain, status: "pending", leadScore: 0 };
        }
        return c;
      }));

      if (detailCompany && detailCompany.id === companyId) {
        setDetailCompany(prev => prev ? {
          ...prev,
          website: newVal || null,
          domain: newVal ? (newVal.startsWith("http") ? newVal.replace(/https?:\/\/(www\.)?/, "") : newVal.toLowerCase()) : null,
          status: "pending",
          leadScore: 0
        } : null);
      }

      setEditingWebsiteCompanyId(null);

      const res = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: newVal }),
      });

      const data = await res.json();
      if (data.error) {
        console.error("Failed to save website:", data.error);
        alert(data.error);
        fetchCompanies();
      }
    } catch (err) {
      console.error(err);
      fetchCompanies();
    }
  };

  const fetchCompanies = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "200",
        search,
        city,
        status,
        tag,
        sortBy,
        naceSection,
        naceDivision,
        naceSubdivision,
        legalForm,
      });

      const res = await fetch(`/api/companies?${params.toString()}`);
      const data = await res.json();
      if (!data.error) {
        setCompanies(data.companies);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch details when ID selected
  useEffect(() => {
    if (selectedCompanyId === null) {
      setDetailCompany(null);
      setDetailSnapshot(null);
      setDetailEvents([]);
      setDetailComms([]);
      setExpandedComm(null);
      return;
    }

    const fetchDetails = async () => {
      try {
        setDetailLoading(true);
        setExpandedComm(null);
        const res = await fetch(`/api/companies/${selectedCompanyId}/crawl`);
        const data = await res.json();
        if (!data.error) {
          setDetailCompany(data.company);
          setDetailSnapshot(data.snapshot);
          setDetailEvents(data.events || []);
          setDetailComms(data.communications || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setDetailLoading(false);
      }
    };

    fetchDetails();
  }, [selectedCompanyId]);

  useEffect(() => {
    if (detailCompany) {
      setCallNote(detailCompany.lastCalledNote || "");
      setCallDate(
        detailCompany.lastCalledAt
          ? new Date(detailCompany.lastCalledAt - new Date().getTimezoneOffset() * 60 * 1000)
              .toISOString()
              .slice(0, 16)
          : ""
      );
      setEmailNote(detailCompany.lastEmailedNote || "");
      setEmailDate(
        detailCompany.lastEmailedAt
          ? new Date(detailCompany.lastEmailedAt - new Date().getTimezoneOffset() * 60 * 1000)
              .toISOString()
              .slice(0, 16)
          : ""
      );
    }
  }, [detailCompany]);

  // Fetch rivals
  const fetchRivals = async () => {
    try {
      setRivalsLoading(true);
      const params = new URLSearchParams({
        page: rivalsPage.toString(),
        limit: "50",
        search: rivalsSearch,
        sortBy: rivalsSortBy,
      });
      const res = await fetch(`/api/rivals?${params.toString()}`);
      const data = await res.json();
      if (!data.error) {
        setRivalsData(data.rivals);
        setRivalsTotalPages(data.totalPages);
        setRivalsTotalCount(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRivalsLoading(false);
    }
  };

  // Fetch rival details
  useEffect(() => {
    if (selectedRivalId === null) {
      setRivalDetail(null);
      setRivalClients([]);
      return;
    }
    const fetchRivalDetail = async () => {
      try {
        setRivalDetailLoading(true);
        const res = await fetch(`/api/rivals/${selectedRivalId}`);
        const data = await res.json();
        if (!data.error) {
          setRivalDetail(data.rival);
          setRivalClients(data.clients || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setRivalDetailLoading(false);
      }
    };
    fetchRivalDetail();
  }, [selectedRivalId]);

  // Fetch subdivisions dynamically when division changes
  useEffect(() => {
    if (!naceDivision) {
      setDynamicSubdivisions([]);
      return;
    }

    const fetchSubdivisions = async () => {
      try {
        setSubdivisionsLoading(true);
        const res = await fetch(`/api/nace?division=${naceDivision}`);
        const data = await res.json();
        if (!data.error && data.subdivisions) {
          setDynamicSubdivisions(data.subdivisions);
        } else {
          setDynamicSubdivisions([]);
        }
      } catch (e) {
        console.error("Error fetching subdivisions:", e);
        setDynamicSubdivisions([]);
      } finally {
        setSubdivisionsLoading(false);
      }
    };

    fetchSubdivisions();
  }, [naceDivision]);

  // Initial load and dependency triggers
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [page, search, city, status, tag, sortBy, naceSection, naceDivision, naceSubdivision, legalForm]);

  useEffect(() => {
    if (activeTab === "rivals") {
      fetchRivals();
    }
  }, [activeTab, rivalsPage, rivalsSearch, rivalsSortBy]);

  useEffect(() => {
    setJumpPageInput(page.toString());
  }, [page]);

  useEffect(() => {
    setJumpRivalsPageInput(rivalsPage.toString());
  }, [rivalsPage]);

  // Trigger manual crawl
  const handleSingleCrawl = async (id: number) => {
    try {
      setIsCrawlingSingle(true);
      const res = await fetch(`/api/companies/${id}/crawl`, { method: "POST" });
      const data = await res.json();
      if (!data.error) {
        // Update local views
        setCompanies((prev) =>
          prev.map((c) => (c.id === id ? data.company : c))
        );
        if (selectedCompanyId === id) {
          setDetailCompany(data.company);
          setDetailSnapshot(data.snapshot);
          setDetailEvents(data.events || []);
        }
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCrawlingSingle(false);
    }
  };

  // Add temporary manual communication log row in UI
  const handleAddManualComm = (channel: "call" | "email") => {
    const tempId = `temp-${Date.now()}`;
    const newComm = {
      id: tempId,
      channel,
      direction: "out",
      occurredAt: Date.now(),
      subject: "",
      bodyText: "",
      source: "manual",
      isNew: true,
    };
    setDetailComms((prev) => [newComm, ...prev]);
  };

  // Save manual communication log to SQLite
  const handleSaveManualComm = async (comm: any) => {
    if (!detailCompany) return;
    try {
      const res = await fetch(`/api/companies/${detailCompany.id}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: comm.channel,
          occurredAt: comm.occurredAt,
          note: comm.subject,
        }),
      });
      const data = await res.json();
      if (!data.error && data.communication) {
        setDetailComms((prev) =>
          prev.map((item) => (item.id === comm.id ? data.communication : item))
        );
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === detailCompany.id && comm.channel === "email"
              ? { ...c, commCount: (c.commCount ?? 0) + 1 }
              : c
          )
        );
      }
    } catch (e) {
      console.error("Error saving manual communication:", e);
    }
  };

  // Delete manual communication log
  const handleDeleteManualComm = async (commId: number) => {
    if (!detailCompany) return;
    if (!confirm("Are you sure you want to delete this interaction log?")) return;
    try {
      const res = await fetch(`/api/companies/${detailCompany.id}/communications?commId=${commId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.error) {
        const deletedComm = detailComms.find((item) => item.id === commId);
        setDetailComms((prev) => prev.filter((item) => item.id !== commId));
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === detailCompany.id && deletedComm?.channel === "email"
              ? { ...c, commCount: Math.max(0, (c.commCount ?? 0) - 1) }
              : c
          )
        );
      }
    } catch (e) {
      console.error("Error deleting communication:", e);
    }
  };

  // Trigger batch crawl
  const handleBatchCrawl = async () => {
    try {
      setIsCrawlingBatch(true);
      setCrawlProgressMessage("Crawling next 20 pending websites...");
      const res = await fetch("/api/crawler/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 20, concurrency: 5 }),
      });
      const data = await res.json();
      if (!data.error) {
        setCrawlProgressMessage(
          `Crawl completed: ${data.succeededCount} / ${data.totalTargeted} succeeded in ${data.durationSeconds}s!`
        );
        fetchStats();
        fetchCompanies();
        setTimeout(() => setCrawlProgressMessage(""), 5000);
      }
    } catch (e) {
      console.error(e);
      setCrawlProgressMessage("Error executing batch crawl");
      setTimeout(() => setCrawlProgressMessage(""), 5000);
    } finally {
      setIsCrawlingBatch(false);
    }
  };

  const fetchCRM = async (silent = false) => {
    try {
      if (!silent) setCrmLoading(true);
      const res = await fetch("/api/crm");
      const data = await res.json();
      if (!data.error) {
        setCrmLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Error fetching CRM logs:", e);
    } finally {
      if (!silent) setCrmLoading(false);
    }
  };

  // Add company manually to today's CRM log
  const handleAddCompanyToCRM = async (companyId: number) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "view",
          occurredAt: Date.now(),
          note: "Added to CRM tracker",
        }),
      });
      const data = await res.json();
      if (!data.error && data.communication) {
        setDetailComms((prev) => [data.communication, ...prev]);
        fetchCRM(true);
      }
    } catch (e) {
      console.error("Error adding to CRM:", e);
    }
  };

  const handleAddCompanyToNextDayLeads = async (companyId: number) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "view",
          occurredAt: tomorrow.getTime(),
          note: "[NEXT_DAY_LEAD] New lead",
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, hasNextDayLead: true } : c))
        );
        fetchCRM(true);
      }
    } catch (e) {
      console.error("Error adding next-day lead:", e);
    }
  };

  const createNextDayWishlistLead = async (companyId: number, note: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const res = await fetch(`/api/companies/${companyId}/communications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "view",
        occurredAt: tomorrow.getTime(),
        note,
      }),
    });
    return res.json();
  };

  const deleteCompanyMarker = async (companyId: number, marker: "next_day_lead" | "new_site_coming_lead" | "broken_website_lead") => {
    const res = await fetch(`/api/companies/${companyId}/communications?marker=${marker}`, {
      method: "DELETE",
    });
    return res.json();
  };

  const handleCycleHeartLead = async (company: Company) => {
    const hasNextDayLead = Boolean(company.hasNextDayLead);
    const hasBrokenWebsiteLead = Boolean(company.hasBrokenWebsiteLead);

    try {
      if (!hasNextDayLead && !hasBrokenWebsiteLead) {
        const data = await createNextDayWishlistLead(company.id, "[NEXT_DAY_LEAD] New lead");
        if (!data.error) {
          setCompanies((prev) =>
            prev.map((c) => (c.id === company.id ? { ...c, hasNextDayLead: true, hasBrokenWebsiteLead: false } : c))
          );
          fetchCRM(true);
        }
        return;
      }

      if (hasNextDayLead) {
        await deleteCompanyMarker(company.id, "next_day_lead");
        const data = await createNextDayWishlistLead(company.id, "[NEXT_DAY_LEAD] [HEART:broken] Broken website wishlist");
        if (!data.error) {
          setCompanies((prev) =>
            prev.map((c) => (c.id === company.id ? { ...c, hasNextDayLead: false, hasBrokenWebsiteLead: true } : c))
          );
          fetchCRM(true);
        }
        return;
      }

      const data = await deleteCompanyMarker(company.id, "broken_website_lead");
      if (!data.error) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === company.id ? { ...c, hasBrokenWebsiteLead: false } : c))
        );
        fetchCRM(true);
      }
    } catch (e) {
      console.error("Error cycling heart lead:", e);
    }
  };

  const handleCycleWebsiteStar = async (company: Company) => {
    const hasNewWebsiteTag = Boolean(company.hasNewWebsiteTag);
    const hasNewSiteComingTag = Boolean(company.hasNewSiteComingTag);

    try {
      if (!hasNewWebsiteTag && !hasNewSiteComingTag) {
        const res = await fetch(`/api/companies/${company.id}/communications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "view",
            occurredAt: Date.now(),
            note: "[TAG:new_website]",
          }),
        });
        const data = await res.json();
        if (!data.error) {
          setCompanies((prev) =>
            prev.map((c) => (c.id === company.id ? { ...c, hasNewWebsiteTag: true, hasNewSiteComingTag: false } : c))
          );
        }
        return;
      }

      if (hasNewWebsiteTag) {
        await fetch(`/api/companies/${company.id}/communications?tag=new_website`, { method: "DELETE" });
        const tagRes = await fetch(`/api/companies/${company.id}/communications`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: "view",
            occurredAt: Date.now(),
            note: "[TAG:new_site_coming]",
          }),
        });
        const leadData = await createNextDayWishlistLead(company.id, "[NEXT_DAY_LEAD] [STAR:coming] New site coming");
        const tagData = await tagRes.json();
        if (!tagData.error && !leadData.error) {
          setCompanies((prev) =>
            prev.map((c) => (c.id === company.id ? { ...c, hasNewWebsiteTag: false, hasNewSiteComingTag: true } : c))
          );
          fetchCRM(true);
        }
        return;
      }

      const tagRes = await fetch(`/api/companies/${company.id}/communications?tag=new_site_coming`, { method: "DELETE" });
      await deleteCompanyMarker(company.id, "new_site_coming_lead");
      const tagData = await tagRes.json();
      if (!tagData.error) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === company.id ? { ...c, hasNewSiteComingTag: false } : c))
        );
        fetchCRM(true);
      }
    } catch (e) {
      console.error("Error cycling website star:", e);
    }
  };

  const handleToggleCompanyTag = async (companyId: number, tag: "new_website" | "no_website", isActive: boolean) => {
    const flagKey = tag === "new_website" ? "hasNewWebsiteTag" : "hasNoWebsiteTag";
    try {
      const res = await fetch(`/api/companies/${companyId}/communications${isActive ? `?tag=${tag}` : ""}`, {
        method: isActive ? "DELETE" : "POST",
        headers: isActive ? undefined : { "Content-Type": "application/json" },
        body: isActive
          ? undefined
          : JSON.stringify({
              channel: "view",
              occurredAt: Date.now(),
              note: `[TAG:${tag}]`,
            }),
      });
      const data = await res.json();
      if (!data.error) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, [flagKey]: !isActive } : c))
        );
      }
    } catch (e) {
      console.error("Error toggling company tag:", e);
    }
  };

  // Save inline logged call/email from CRM tab
  const handleSaveInlineLog = async (companyId: number) => {
    if (!inlineLogType) return;
    const note = inlineLogNote.trim() || `${inlineLogType === "call" ? "Hovor" : "E-mail"} zaznamenaný`;
    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: inlineLogType,
          occurredAt: Date.now(),
          note,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setInlineLogCompanyId(null);
        setInlineLogType(null);
        setInlineLogNote("");
        fetchCRM(true);
        fetchCompanies(true);
      }
    } catch (e) {
      console.error("Error saving inline CRM log:", e);
    }
  };

  // Quick call outcome log (no typing needed)
  const handleQuickCallLog = async (companyId: number, outcome: "remind" | "noanswer" | "interest" | "decline" | "warning") => {
    const noteMap = {
      remind: "Pripomenúť ďalší deň",
      noanswer: "Nezdvihol",
      interest: "",
      decline: "",
      warning: "",
    };
    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "call",
          occurredAt: Date.now(),
          note: noteMap[outcome],
          outcome,
        }),
      });
      const data = await res.json();
      if (!data.error) {
        fetchCRM(true);
        fetchCompanies(true);
      }
    } catch (e) {
      console.error("Error saving quick call log:", e);
    }
  };

  const openReminderDatePicker = (companyId: number) => {
    setReminderDateCompanyId(companyId);
    setReminderDateValue(getTomorrowDateValue());
    setReminderNoteValue("");
  };

  const handleSaveReminderDate = async (companyId: number, dateValue = reminderDateValue) => {
    if (!dateValue) return;
    const createdAt = Date.now();
    const reminderTimestamp = getReminderTimestamp(dateValue, createdAt);

    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "call",
          occurredAt: reminderTimestamp,
          note: buildReminderNote(dateValue, reminderNoteValue, createdAt),
          outcome: "remind",
        }),
      });
      const data = await res.json();
      if (!data.error) {
        setReminderDateCompanyId(null);
        setReminderDateValue("");
        setReminderNoteValue("");
        fetchCRM(true);
        fetchCompanies(true);
      }
    } catch (e) {
      console.error("Error saving reminder date:", e);
    }
  };

  const openReminderLogDatePicker = (logId: number, note: string | null | undefined) => {
    setEditingLogId(null);
    setOpenReminderCalendarLogId(logId);
    setEditingReminderDateValue(parseReminderDateValue(note) || getTomorrowDateValue());
  };

  const openReminderLogNoteEditor = (logId: number, note: string | null | undefined) => {
    setEditingLogId(null);
    setOpenReminderCalendarLogId(null);
    setEditingReminderLogId(logId);
    setEditingReminderDateValue(parseReminderDateValue(note) || getTomorrowDateValue());
    setEditingLogText(parseReminderNoteText(note));
  };

  const handleSaveReminderLog = async (commId: number, companyId: number, dateValue = editingReminderDateValue, noteText = editingLogText) => {
    if (!dateValue) return;
    const currentLog = crmLogs.find((log: any) => log.id === commId);
    const currentNote = currentLog?.note || currentLog?.subject || "";
    const originalCallLabel =
      parseReminderOriginalCallDate(currentNote) ||
      formatCompactSkDate(currentLog?.occurredAt || Date.now());
    const occurredAt = getReminderTimestamp(dateValue, currentLog?.occurredAt || Date.now());
    await handleSaveCrmLogNote(commId, companyId, buildReminderNote(dateValue, noteText, originalCallLabel), occurredAt);
    setEditingReminderLogId(null);
    setOpenReminderCalendarLogId(null);
    setEditingReminderDateValue("");
  };

  const handleSaveCrmLogNote = async (commId: number, companyId: number, newNote: string, occurredAt?: number) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commId, note: newNote, occurredAt }),
      });
      const data = await res.json();
      if (!data.error) {
        setEditingLogId(null);
        fetchCRM(true);
      }
    } catch (e) {
      console.error("Error updating CRM log note:", e);
    }
  };

  const handleSaveCrmLogTime = async (commId: number, companyId: number, value = editingLogTimeValue) => {
    if (!value) return;
    const occurredAt = new Date(value).getTime();
    if (Number.isNaN(occurredAt)) return;

    try {
      const res = await fetch(`/api/companies/${companyId}/communications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commId, occurredAt }),
      });
      const data = await res.json();
      if (!data.error) {
        setEditingLogTimeId(null);
        fetchCRM(true);
        if (detailCompany && detailCompany.id === companyId) {
          setDetailComms((prev) =>
            prev.map((item) => (item.id === commId ? { ...item, occurredAt } : item))
          );
        }
      }
    } catch (e) {
      console.error("Error updating CRM log time:", e);
    }
  };

  const handleRemoveCompanyFromCRM = async (companyId: number, dateStr: string) => {
    if (!confirm("Naozaj chcete odstrániť túto firmu a všetky jej aktivity z dnešného plánu CRM?")) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/communications?allForDate=${dateStr}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.error) {
        fetchCRM(true);
        fetchCompanies(true);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error("Error removing from CRM:", e);
    }
  };

  const handleDeleteCrmLog = async (commId: number, companyId: number) => {
    if (!confirm("Naozaj chcete vymazať tento záznam aktivity?")) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/communications?commId=${commId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.error) {
        fetchCRM(true);
        const deletedLog = crmLogs.find((item: any) => item.id === commId) || detailComms.find((item) => item.id === commId);
        if (detailCompany && detailCompany.id === companyId) {
          setDetailComms((prev) => prev.filter((item) => item.id !== commId));
        }
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === companyId && deletedLog?.channel === "email"
              ? { ...c, commCount: Math.max(0, (c.commCount ?? 0) - 1) }
              : c
          )
        );
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error("Error deleting CRM log:", e);
    }
  };

  const handleRemoveWarning = async (companyId: number) => {
    const warningLog = crmLogs.find(
      (log: any) => log.companyId === companyId && (getCrmOutcome(log.subject) || getCrmOutcome(log.note)) === "warning"
    );
    if (!warningLog) {
      setWarningMenuCompanyId(null);
      return;
    }

    try {
      const res = await fetch(`/api/companies/${companyId}/communications?commId=${warningLog.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.error) {
        setWarningMenuCompanyId(null);
        fetchCRM(true);
        fetchCompanies(true);
        setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, hasWarning: false } : c)));
        if (detailCompany?.id === companyId) {
          setDetailCompany((prev) => (prev ? { ...prev, hasWarning: false } : prev));
          setDetailComms((prev) => prev.filter((item) => item.id !== warningLog.id));
        }
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error("Error removing warning:", e);
    }
  };

  // Fetch CRM logs when CRM tab becomes active
  useEffect(() => {
    if (activeTab === "crm") {
      fetchCRM();
    }
  }, [activeTab]);

  const getScoreColor = (score: number) => {
    if (score >= 60) return "text-rose-400 bg-rose-500/10 border-rose-500/20";
    if (score >= 35) return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
  };

  const getScoreBadge = (score: number, status: string) => {
    if (status === "dead" || !status) return "Dead / No Website";
    if (score >= 60) return "Hot Lead";
    if (score >= 35) return "Warm Opportunity";
    return "Low Priority";
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 flex flex-col p-6 w-full gap-6">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 flex items-center gap-2">
            Eagle Eye <span className="text-xs font-semibold px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 uppercase">Slovak B2B CRM</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Website Intelligence and scoring for construction & plumbing companies
          </p>
        </div>

        {/* Tab Navigation & Legal Form Selector */}
        <div className="flex flex-col items-end gap-2.5">
          {/* Tab Navigation */}
          <nav className="flex gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/5 w-fit">
            <button
              onClick={() => { setActiveTab("companies"); setSelectedRivalId(null); }}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === "companies"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Building className="h-4 w-4" />
              Companies
            </button>
            <button
              onClick={() => { setActiveTab("rivals"); setSelectedCompanyId(null); }}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === "rivals"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Swords className="h-4 w-4" />
              Rivals
              {rivalsTotalCount > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === "rivals" ? "bg-white/20 text-white" : "bg-rose-500/20 text-rose-400"
                }`}>
                  {rivalsTotalCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { setActiveTab("crm"); setSelectedRivalId(null); setSelectedCompanyId(null); }}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer ${
                activeTab === "crm"
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Users className="h-4 w-4" />
              CRM
            </button>
          </nav>

          {activeTab === "companies" && (
            <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-white/10 select-none w-fit">
              <button
                onClick={() => { setLegalForm(""); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  legalForm === ""
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All Entities
              </button>
              <button
                onClick={() => { setLegalForm("sro"); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  legalForm === "sro"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                s.r.o.
              </button>
              <button
                onClick={() => { setLegalForm("sole_trader"); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  legalForm === "sole_trader"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Živnosti
              </button>
            </div>
          )}
        </div>
      </header>



      {/* Main CRM Workspace */}
      <main className="flex-1 flex flex-col gap-6 relative">

      {activeTab === "companies" && (<>
        {/* Table & Filtering */}
        <section className="w-full glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/5">
          {/* Controls Bar */}
          <div className="p-4 border-b border-white/5 flex flex-col gap-3">
            {/* Row 1: Search & Filter selections */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by company name, domain, city..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Status filter */}
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending Crawl</option>
                <option value="live">Website Live</option>
                <option value="dead">Website Dead</option>
                <option value="redirect">Redirected</option>
              </select>

              {/* Tag/Priority filter */}
              <select
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Lead Scopes</option>
                <option value="clients">✉️ My Clients (emailed)</option>
                <option value="hot">Hot Leads (≥60)</option>
                <option value="warm">Warm Opportunities (35-59)</option>
                <option value="low">Low Priority (&lt;35)</option>
                <option value="no_website">No Website</option>
              </select>
            </div>

            {/* NACE Section Selectable Buttons */}
            <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                  NACE Section Filter
                </label>
                {naceSection && (
                  <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Selected: {naceSection} - {NACE_SECTIONS.find(s => s.code === naceSection)?.name}
                  </span>
                )}
              </div>

              {/* Row 1: All + A to J */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSectionChange("")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                    naceSection === ""
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`}
                  title="All Sections (A-U)"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>ALL</span>
                </button>
                {NACE_SECTIONS.slice(0, 10).map((sec) => {
                  const Icon = NACE_ICONS[sec.code] || Sprout;
                  return (
                    <button
                      key={sec.code}
                      type="button"
                      onClick={() => handleSectionChange(sec.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        naceSection === sec.code
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                      title={`${sec.code} - ${sec.name}`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${naceSection === sec.code ? "text-white" : "text-slate-400"}`} />
                      <span>{sec.code} - {sec.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Row 2: K to U */}
              <div className="flex flex-wrap gap-1.5">
                {NACE_SECTIONS.slice(10).map((sec) => {
                  const Icon = NACE_ICONS[sec.code] || Sprout;
                  return (
                    <button
                      key={sec.code}
                      type="button"
                      onClick={() => handleSectionChange(sec.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        naceSection === sec.code
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                      title={`${sec.code} - ${sec.name}`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${naceSection === sec.code ? "text-white" : "text-slate-400"}`} />
                      <span>{sec.code} - {sec.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* NACE Division Selectable Buttons */}
            {naceSection && getDivisionsForSection(naceSection).length > 0 && (
              <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                    NACE Division Filter
                  </label>
                  {naceDivision && (
                    <span className="text-[10px] text-indigo-400 font-semibold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      Selected: {naceDivision} - {NACE_DIVISIONS_SK[naceDivision] || "Neznáma divízia"}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDivisionChange("")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                      naceDivision === ""
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                        : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <span>ALL DIVISIONS</span>
                  </button>
                  {getDivisionsForSection(naceSection).map((div) => (
                    <button
                      key={div.code}
                      type="button"
                      onClick={() => handleDivisionChange(div.code)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                        naceDivision === div.code
                          ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20"
                          : "bg-slate-950/40 border-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/5"
                      }`}
                      title={div.name}
                    >
                      <span>{div.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Row 2: NACE & Legal Form filters */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-4 border-t border-white/5 pt-3 mt-1">
              <div className="flex flex-wrap items-center gap-3">

                {/* NACE Subdivision */}
                {naceDivision && (
                  <div className="flex flex-col gap-1.5 flex-1 min-w-[200px] sm:flex-initial">
                    <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider flex items-center gap-1.5">
                      <span>NACE Subdivision</span>
                      {subdivisionsLoading && (
                        <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
                      )}
                    </label>
                    <select
                      value={naceSubdivision}
                      onChange={(e) => handleSubdivisionChange(e.target.value)}
                      disabled={subdivisionsLoading}
                      className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 w-full disabled:opacity-50"
                    >
                      <option value="">
                        {subdivisionsLoading ? "Načítavam..." : "Všetky podkategórie"}
                      </option>
                      {dynamicSubdivisions.map((subCode) => (
                        <option key={subCode} value={subCode}>
                          {getNaceDescription(subCode)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>

            {/* Row 3: Sort and Metrics status */}
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Found {totalCount} matching targets</span>
              </div>

              <div className="flex items-center gap-2">
                <span>Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent text-indigo-400 font-medium focus:outline-none cursor-pointer"
                >
                  <option value="score_desc">Highest Score</option>
                  <option value="score_asc">Lowest Score</option>
                  <option value="revenue_desc">Highest Revenue</option>
                  <option value="revenue_asc">Lowest Revenue</option>
                  <option value="name_asc">Company Name A-Z</option>
                  <option value="last_crawled_desc">Recently Crawled</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                Loading company database...
              </div>
            ) : companies.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-1">
                <AlertCircle className="h-5 w-5 text-indigo-400 mb-1" />
                <span>No companies match your filters.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white/2">
                    <th className="py-2 px-3">Company Name</th>
                    <th className="py-2 px-1 w-28"></th>
                    <th className="py-2 px-3">Website</th>
                    <th className="py-2 px-3 text-right">Revenue</th>
                    <th className="py-2 px-3 text-right">Profit</th>
                    <th className="py-2 px-3">Contact Info</th>
                    <th className="py-2 px-3">City</th>
                    <th className="py-2 px-3 text-center">Score</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-right hidden xl:table-cell">Last Audited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {companies.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      className={`group/row transition cursor-pointer ${
                        selectedCompanyId === c.id
                          ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                          : c.revenue !== null && c.revenue !== undefined
                          ? "bg-emerald-950/25 hover:bg-emerald-950/40"
                          : "hover:bg-white/3"
                      }`}
                    >
                      <td className="py-1.5 px-3">
                        <div className="font-semibold text-slate-100 flex items-center gap-2 flex-wrap">
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(c.name + (c.city ? " " + c.city : ""))}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-indigo-400 hover:underline cursor-pointer transition text-slate-100"
                            title={`Search "${c.name}" on Google`}
                          >
                            {c.name}
                          </a>
                          {Boolean(c.hasWarning) && (
                            <span className="relative flex-shrink-0">
                              <button
                                type="button"
                                title="Pozor: nepríjemná komunikácia"
                                className="text-yellow-300 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setWarningMenuCompanyId(warningMenuCompanyId === c.id ? null : c.id);
                                }}
                              >
                                ⚠️
                              </button>
                              {warningMenuCompanyId === c.id && (
                                <div className="absolute left-0 top-full mt-1 z-[80] w-36 rounded-lg border border-yellow-400/30 bg-slate-950 p-1 shadow-xl">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveWarning(c.id);
                                    }}
                                    className="w-full rounded px-2 py-1 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/5"
                                  >
                                    Remove warning
                                  </button>
                                </div>
                              )}
                            </span>
                          )}
                          {(c.commCount ?? 0) > 0 && (
                            <span
                              title={`${c.commCount} emails on record`}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 select-none flex-shrink-0 flex items-center gap-0.5"
                            >
                              <Mail className="h-2.5 w-2.5" />
                              {c.commCount}
                            </span>
                          )}
                          {c.legalFormCode && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 uppercase select-none flex-shrink-0">
                              {c.legalFormCode === "sro" ? "s.r.o." : "Živnosť"}
                            </span>
                          )}
                          {c.nace && (
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400 select-none flex-shrink-0">
                              NACE {c.nace}
                            </span>
                          )}
                          {(c.commCount ?? 0) > 0 && (
                            <span
                              className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)] flex-shrink-0"
                              title="Nedávna aktivita / Záznam v CRM"
                            />
                          )}
                          {c.finstatRank && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-0.5 select-none flex-shrink-0">
                              🏆 #{c.finstatRank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-1">
                        <div className="flex items-center justify-center gap-1">
                          {(() => {
                            const hasNextDayLead = Boolean(c.hasNextDayLead);
                            const hasBrokenWebsiteLead = Boolean(c.hasBrokenWebsiteLead);
                            const hasNewWebsiteTag = Boolean(c.hasNewWebsiteTag);
                            const hasNewSiteComingTag = Boolean(c.hasNewSiteComingTag);
                            const hasNoWebsiteTag = Boolean(c.hasNoWebsiteTag);
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCycleHeartLead(c);
                                  }}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    hasBrokenWebsiteLead
                                      ? "opacity-100 border-slate-500 bg-slate-950 text-slate-100"
                                      : hasNextDayLead
                                      ? "opacity-100 border-rose-400/40 bg-rose-500/15 text-rose-300"
                                      : "opacity-20 group-hover/row:opacity-100 focus:opacity-100 border-rose-400/25 bg-rose-500/5 text-rose-300 hover:text-rose-100 hover:bg-rose-500/20"
                                  }`}
                                  title={
                                    hasBrokenWebsiteLead
                                      ? "Wishlist: pokazený web"
                                      : hasNextDayLead
                                      ? "Už je v budúcom CRM zozname"
                                      : "Pridať do zajtrajšieho CRM zoznamu"
                                  }
                                >
                                  {hasBrokenWebsiteLead ? (
                                    <span className="relative block h-3.5 w-3.5 text-[14px] leading-[14px]">
                                      <span className="absolute inset-0 flex items-center justify-center">♥</span>
                                      <span className="absolute -right-1 -top-1 text-[10px] font-black text-amber-300">!</span>
                                    </span>
                                  ) : (
                                    <Heart className={`h-3.5 w-3.5 ${hasNextDayLead ? "fill-current" : ""}`} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCycleWebsiteStar(c);
                                  }}
                                  className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                    hasNewSiteComingTag
                                      ? "opacity-100 border-orange-400/50 bg-orange-500/20 text-orange-300"
                                      : hasNewWebsiteTag
                                      ? "opacity-100 border-amber-400/40 bg-amber-500/15 text-amber-300"
                                      : "opacity-20 group-hover/row:opacity-100 focus:opacity-100 border-white/10 bg-white/2 text-slate-400 hover:text-amber-300 hover:bg-amber-500/10"
                                  }`}
                                  title={
                                    hasNewSiteComingTag
                                      ? "Na starom webe píšu, že nový web sa pripravuje"
                                      : hasNewWebsiteTag
                                      ? "Nový web, netreba služby"
                                      : "Označiť nový web"
                                  }
                                >
                                  <span className="relative block h-3.5 w-3.5">
                                    <Star className={`h-3.5 w-3.5 ${hasNewWebsiteTag || hasNewSiteComingTag ? "fill-current" : ""}`} />
                                    {hasNewSiteComingTag && (
                                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-slate-950">
                                        ?
                                      </span>
                                    )}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleCompanyTag(c.id, "no_website", hasNoWebsiteTag);
                                  }}
                                  className={`h-7 min-w-7 rounded-lg border px-1.5 text-[11px] font-extrabold transition cursor-pointer ${
                                    hasNoWebsiteTag
                                      ? "opacity-100 border-sky-400/40 bg-sky-500/15 text-sky-300"
                                      : "opacity-20 group-hover/row:opacity-100 focus:opacity-100 border-white/10 bg-white/2 text-slate-400 hover:text-sky-300 hover:bg-sky-500/10"
                                  }`}
                                  title="Nemá web vôbec"
                                >
                                  N
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td 
                        className="py-1.5 px-3 min-w-[150px]"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (editingWebsiteCompanyId !== c.id) {
                            setEditingWebsiteCompanyId(c.id);
                            setEditingWebsiteValue(c.website || "");
                          }
                        }}
                      >
                        {editingWebsiteCompanyId === c.id ? (
                          <input
                            type="text"
                            value={editingWebsiteValue}
                            onChange={(e) => setEditingWebsiteValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveWebsite(c.id);
                              if (e.key === "Escape") setEditingWebsiteCompanyId(null);
                            }}
                            onBlur={() => handleSaveWebsite(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-slate-950/80 border border-indigo-500/50 rounded px-2 py-0.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                            placeholder="Enter URL..."
                            autoFocus
                          />
                        ) : (
                          <div className="group flex items-center justify-between gap-1.5 cursor-pointer">
                            {c.domain ? (
                              <a
                                href={c.website || `https://${c.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium text-xs flex items-center gap-1 inline-flex"
                              >
                                <span>{c.domain}</span>
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              </a>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingWebsiteCompanyId(c.id);
                                setEditingWebsiteValue(c.website || "");
                              }}
                              className="opacity-0 group-hover:opacity-100 transition p-0.5 text-slate-400 hover:text-indigo-400"
                              title="Edit website"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-300 font-medium whitespace-nowrap">
                        {c.revenue !== null && c.revenue !== undefined ? (
                          <span className="text-emerald-400 font-semibold">
                            {c.revenue >= 1000000 ? `${(c.revenue / 1000000).toFixed(1)}M €` : `${c.revenue.toLocaleString()} €`}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right text-slate-300 font-medium whitespace-nowrap">
                        {c.profit !== null && c.profit !== undefined ? (
                          <span className={c.profit >= 0 ? "text-emerald-500" : "text-rose-400"}>
                            {c.profit >= 0 ? "+" : ""}
                            {c.profit >= 1000000 ? `${(c.profit / 1000000).toFixed(1)}M €` : `${c.profit.toLocaleString()} €`}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-slate-400 text-xs truncate max-w-[200px]">
                        {c.emailsFound || c.phone || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-slate-300 font-medium">
                        {c.city || <span className="text-slate-600">—</span>}
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getScoreColor(
                            c.leadScore
                          )}`}
                        >
                          {c.leadScore}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-center">
                        <span
                          className={`text-xs font-semibold ${
                            c.status === "live"
                              ? "text-emerald-400"
                              : c.status === "redirect"
                              ? "text-cyan-400"
                              : c.status === "pending"
                              ? "text-slate-500"
                              : "text-rose-400"
                          }`}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-right text-xs text-slate-400 hidden xl:table-cell">
                        {formatDate(c.lastCrawledAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>
                Page <span className="font-medium text-slate-200">{page}</span> of{" "}
                <span className="font-medium text-slate-200">{totalPages}</span>
              </span>
              <div className="flex items-center gap-1.5 border border-white/10 rounded-lg px-2 py-0.5 bg-white/2">
                <span>Go to:</span>
                <input
                  type="text"
                  value={jumpPageInput}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = parseInt(jumpPageInput, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setPage(val);
                      } else {
                        setJumpPageInput(page.toString());
                      }
                    }
                  }}
                  className="w-12 bg-transparent text-slate-100 font-semibold text-center focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Floating Selected Company Audit Inspector */}
        {selectedCompanyId !== null && (
          <section className="fixed bottom-6 right-6 w-[420px] max-h-[85vh] glass-panel rounded-2xl p-5 flex flex-col border border-white/10 shadow-2xl z-50 overflow-y-auto">
            {detailLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
                <span className="text-xs">Analyzing and loading database audit...</span>
              </div>
            ) : detailCompany ? (
              <div className="flex-1 flex flex-col gap-5">
                {/* Header Details */}
                <div className="border-b border-white/5 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 max-w-[70%]">
                      <h3 className="font-extrabold text-lg text-slate-100 leading-tight">{detailCompany.name}</h3>
                      {Boolean(detailCompany.hasWarning) && (
                        <span className="relative">
                          <button
                            type="button"
                            title="Pozor: nepríjemná komunikácia"
                            className="text-yellow-300 cursor-pointer"
                            onClick={() => setWarningMenuCompanyId(warningMenuCompanyId === detailCompany.id ? null : detailCompany.id)}
                          >
                            ⚠️
                          </button>
                          {warningMenuCompanyId === detailCompany.id && (
                            <div className="absolute left-0 top-full mt-1 z-[80] w-36 rounded-lg border border-yellow-400/30 bg-slate-950 p-1 shadow-xl">
                              <button
                                type="button"
                                onClick={() => handleRemoveWarning(detailCompany.id)}
                                className="w-full rounded px-2 py-1 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/5"
                              >
                                Remove warning
                              </button>
                            </div>
                          )}
                        </span>
                      )}
                      {(detailCompany.commCount ?? 0) > 0 && (
                        <span
                          title={`${detailCompany.commCount} emails on record`}
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 select-none flex-shrink-0 flex items-center gap-0.5"
                        >
                          <Mail className="h-2.5 w-2.5" />
                          {detailCompany.commCount}
                        </span>
                      )}
                      {detailCompany.finstatRank && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-0.5 select-none">
                          🏆 FinStat Top #{detailCompany.finstatRank}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleAddManualComm("call")}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 hover:text-indigo-400 cursor-pointer"
                        title="Log a phone call"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleAddManualComm("email")}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 hover:text-indigo-400 cursor-pointer"
                        title="Log an email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleSingleCrawl(detailCompany.id)}
                        disabled={isCrawlingSingle}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer disabled:opacity-40"
                        title="Recrawl site now"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isCrawlingSingle ? "animate-spin" : ""}`} />
                      </button>
                      <button
                        onClick={() => setSelectedCompanyId(null)}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer hover:text-rose-400"
                        title="Close panel"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {detailCompany.address || detailCompany.city || "Slovakia"}
                  </p>

                  {/* Manual CRM Tracker trigger */}
                  {(() => {
                    const isCompanyInCRM = detailComms.some(m => {
                      if (m.channel !== "view") return false;
                      const logDate = new Date(m.occurredAt).toISOString().slice(0, 10);
                      const todayStr = new Date().toISOString().slice(0, 10);
                      return logDate === todayStr;
                    });

                    return (
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">CRM Daily Log</span>
                        <button
                          onClick={() => handleAddCompanyToCRM(detailCompany.id)}
                          disabled={isCompanyInCRM}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                            isCompanyInCRM
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 opacity-80 cursor-default"
                              : "bg-slate-900 border-white/10 text-slate-300 hover:border-indigo-500 hover:text-white"
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {isCompanyInCRM ? "Added to Today" : "Add to CRM Today"}
                        </button>
                      </div>
                    );
                  })()}
                </div>

              {/* Audit Score Breakdown */}
              <div className="bg-slate-950/40 border border-white/5 rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Lead Health Score</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getScoreColor(detailCompany.leadScore)}`}>
                    {getScoreBadge(detailCompany.leadScore, detailCompany.status)}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-4xl font-extrabold text-white">{detailCompany.leadScore}</span>
                  <span className="text-xs text-slate-500">/ 100 Points</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full ${
                      detailCompany.leadScore >= 60
                        ? "bg-rose-500"
                        : detailCompany.leadScore >= 35
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${detailCompany.leadScore}%` }}
                  ></div>
                </div>
              </div>

              {/* Contact & Website Information */}
              <div className="flex flex-col gap-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact & Website</h4>
                {detailCompany.website && (
                  <div className="text-sm flex items-center gap-2 text-indigo-400 font-semibold truncate hover:text-indigo-300">
                    <Globe className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <a href={detailCompany.website} target="_blank" rel="noreferrer" className="truncate hover:underline">
                      {detailCompany.website}
                    </a>
                  </div>
                )}
                {detailCompany.phone && (
                  <div className="text-sm flex items-center gap-2 text-slate-300">
                    <Phone className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span>{detailCompany.phone}</span>
                  </div>
                )}
                {detailCompany.emailsFound && (
                  <div className="text-sm flex items-center gap-2 text-slate-300">
                    <Mail className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                    <span>{detailCompany.emailsFound}</span>
                  </div>
                )}
                {!detailCompany.website && !detailCompany.phone && !detailCompany.emailsFound && (
                  <div className="text-xs text-slate-600 italic">No contact details or website listed.</div>
                )}
              </div>

              {/* Business Classification & Legal Details */}
              <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Classification & Legal Form</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Legal Form</span>
                    <span className="font-bold text-slate-200">
                      {detailCompany.legalFormCode === "sro" ? "Spoločnosť (s.r.o. / a.s.)" : "Fyzická osoba (Živnostník)"}
                    </span>
                  </div>
                  <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">SK NACE Code</span>
                    <span className="font-bold text-slate-200">
                      {detailCompany.nace || "Not Classified"}
                    </span>
                  </div>
                </div>
                {detailCompany.nace && (
                  <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">Activity Description</span>
                    <span className="font-medium text-slate-300 text-xs leading-normal">
                      {getNaceDescription(detailCompany.nace)}
                    </span>
                  </div>
                )}
                {detailCompany.naceSection && (
                  <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">NACE Section</span>
                    <span className="font-medium text-slate-300 text-xs leading-normal">
                      {getNaceDescription(detailCompany.naceSection)}
                    </span>
                  </div>
                )}
                {detailCompany.naceDivision && (
                  <div className="bg-white/2 border border-white/5 rounded-xl p-2.5 flex flex-col gap-0.5">
                    <span className="text-[9px] text-slate-500 uppercase font-semibold">NACE Division</span>
                    <span className="font-medium text-slate-300 text-xs leading-normal">
                      {getNaceDescription(detailCompany.naceDivision)}
                    </span>
                  </div>
                )}
              </div>

              {/* Financial Data (if matched from FinStat) */}
              {detailCompany.revenue !== null && detailCompany.revenue !== undefined && (() => {
                let historyData = null;
                if (detailCompany.financialHistory) {
                  try {
                    historyData = JSON.parse(detailCompany.financialHistory);
                  } catch (e) {}
                }

                return (
                  <div className="flex flex-col gap-3.5 border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Intelligence</h4>

                    {historyData && historyData.zisk && historyData.trzby ? (
                      <div className="flex flex-col gap-3">
                        {/* Zisk Chart */}
                        <MiniLineChart
                          title="Zisk"
                          subtitle={detailCompany.name}
                          categories={historyData.zisk.categories}
                          values={historyData.zisk.values}
                          color="#39bf87"
                        />
                        {/* Tržby Chart */}
                        <MiniLineChart
                          title="Tržby"
                          subtitle={detailCompany.name}
                          categories={historyData.trzby.categories}
                          values={historyData.trzby.values}
                          color="#39bf87"
                        />
                        {/* Aktíva & financial metadata below */}
                        <div className="grid grid-cols-2 gap-3 text-xs mt-1">
                          <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex flex-col gap-0.5">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Aktíva</span>
                            <span className="font-extrabold text-cyan-400 text-sm mt-0.5">
                              {(detailCompany.assets || 0) >= 1000000 ? `${((detailCompany.assets || 0) / 1000000).toFixed(1)}M €` : `${(detailCompany.assets || 0).toLocaleString()} €`}
                            </span>
                          </div>
                          <div className="p-3 bg-white/2 border border-white/5 rounded-xl flex flex-col gap-0.5 justify-center">
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">Financial Year</span>
                            <span className="font-bold text-slate-300 text-sm mt-0.5">
                              {detailCompany.financialYear || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Fallback standard 3-column stats if history not loaded yet */
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-1">
                        <div className="p-2 bg-white/2 border border-white/5 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">Tržby</span>
                          <span className="font-bold text-emerald-400">
                            {detailCompany.revenue >= 1000000 ? `${(detailCompany.revenue / 1000000).toFixed(1)}M €` : `${detailCompany.revenue.toLocaleString()} €`}
                          </span>
                        </div>
                        <div className="p-2 bg-white/2 border border-white/5 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">Zisk</span>
                          <span className={`font-bold ${(detailCompany.profit || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {(detailCompany.profit || 0) >= 1000000 ? `${((detailCompany.profit || 0) / 1000000).toFixed(1)}M €` : `${(detailCompany.profit || 0).toLocaleString()} €`}
                          </span>
                        </div>
                        <div className="p-2 bg-white/2 border border-white/5 rounded-xl">
                          <span className="text-[10px] text-slate-500 block">Aktíva</span>
                          <span className="font-bold text-cyan-400">
                            {(detailCompany.assets || 0) >= 1000000 ? `${((detailCompany.assets || 0) / 1000000).toFixed(1)}M €` : `${(detailCompany.assets || 0).toLocaleString()} €`}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="text-[9px] text-slate-600 text-right mt-0.5">Source: FinStat ({detailCompany.financialYear})</div>
                  </div>
                );
              })()}

              {/* Website Tech Stack */}
              {detailSnapshot ? (
                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Website Checklist</h4>
                  
                  {/* Indicators */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-lg bg-white/2 border border-white/5">
                      {detailSnapshot.hasHttps === 1 ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                      )}
                      <span className="text-slate-300">SSL HTTPS</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs py-1.5 px-2.5 rounded-lg bg-white/2 border border-white/5">
                      {detailSnapshot.hasGdpr === 1 ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-400" />
                      )}
                      <span className="text-slate-300">GDPR Compliance</span>
                    </div>
                  </div>

                  {/* Copyright Year */}
                  <div className="text-xs text-slate-400 flex items-center justify-between py-1 border-b border-white/5">
                    <span>Footer Copyright Year:</span>
                    <span className={`font-semibold ${
                      !detailSnapshot.copyrightYear || detailSnapshot.copyrightYear <= 2024
                        ? "text-rose-400"
                        : "text-slate-200"
                    }`}>
                      {detailSnapshot.copyrightYear || "Not Detected"}
                    </span>
                  </div>

                  {/* Detected Tech */}
                  <div className="mt-1">
                    <span className="text-xs text-slate-500 block mb-1.5">Detected Technologies:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(detailSnapshot.techStack || "[]").map((tech: string, i: number) => (
                        <span
                          key={i}
                          className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
                        >
                          {tech}
                        </span>
                      ))}
                      {JSON.parse(detailSnapshot.techStack || "[]").length === 0 && (
                        <span className="text-xs text-slate-500 italic">No frameworks detected.</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900/30 border border-white/5 text-slate-500 text-xs p-3 rounded-lg flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-600" />
                  <span>Website has not been audited yet. Run audit to build score.</span>
                </div>
              )}

              {/* History / Audit Events */}
              <div className="flex-1 flex flex-col gap-2.5 mt-2 overflow-hidden">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <span>Change Log / History</span>
                  {detailEvents.length > 0 && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">
                      {detailEvents.length}
                    </span>
                  )}
                </h4>
                <div className="flex-1 overflow-y-auto max-h-[160px] flex flex-col gap-2 pr-1">
                  {detailEvents.map((evt, idx) => (
                    <div
                      key={evt.id || idx}
                      className="text-xs border-l-2 border-indigo-500/50 pl-3 py-1 flex flex-col bg-white/2 rounded-r-lg"
                    >
                      <span className="text-slate-200 font-semibold">{evt.description}</span>
                      <span className="text-[10px] text-slate-500 mt-0.5">{formatDate(evt.timestamp)}</span>
                    </div>
                  ))}
                  {detailEvents.length === 0 && (
                    <div className="text-xs text-slate-600 italic">No events or status changes recorded.</div>
                  )}
                </div>
              </div>

              {/* Communications / Email history */}
              <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Interaction Logs</span>
                  {detailComms.length > 0 && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">
                      {detailComms.length}
                    </span>
                  )}
                </h4>
                {detailComms.length === 0 ? (
                  <div className="text-xs text-slate-600 italic">No email or call correspondence on record.</div>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                    {detailComms.map((m: any) => {
                      if (m.isNew) {
                        return (
                          <div
                            key={m.id}
                            className="text-xs rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-2 flex flex-col gap-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                {m.channel === "call" ? "📞 New Call" : "✉️ New Email"}
                              </span>
                              <input
                                type="datetime-local"
                                defaultValue={new Date(m.occurredAt - new Date().getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  m.occurredAt = val ? new Date(val).getTime() : Date.now();
                                }}
                                className="bg-slate-900 border border-white/10 rounded px-1 py-0.5 text-[10px] text-slate-200 focus:outline-none"
                              />
                            </div>
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text"
                                placeholder="Note..."
                                onChange={(e) => {
                                  m.subject = e.target.value;
                                  m.bodyText = e.target.value;
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleSaveManualComm(m);
                                  }
                                }}
                                className="bg-slate-900 border border-white/10 rounded px-2 py-0.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 flex-1"
                              />
                              <button
                                onClick={() => handleSaveManualComm(m)}
                                className="px-2 py-0.5 rounded bg-indigo-500 text-white font-bold text-[10px] hover:bg-indigo-600 transition cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setDetailComms((prev) => prev.filter((item) => item.id !== m.id));
                                }}
                                className="p-0.5 rounded hover:bg-white/5 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                title="Discard"
                              >
                                <XCircle className="h-4.5 w-4.5" />
                              </button>
                            </div>
                          </div>
                        );
                      }

                      const out = m.direction === "out";
                      const open = expandedComm === m.id;
                      return (
                        <div
                          key={m.id}
                          className="text-xs rounded-lg bg-white/2 border border-white/5 overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedComm(open ? null : m.id)}
                            className="w-full text-left px-2.5 py-1.5 flex items-start gap-2 hover:bg-white/5 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              {out ? (
                                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <ArrowDownLeft className="h-3.5 w-3.5 text-cyan-400" />
                              )}
                              {m.channel === "call" ? (
                                <Phone className="h-3 w-3 text-indigo-400" />
                              ) : (
                                <Mail className="h-3 w-3 text-sky-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-slate-300 truncate">
                                  {m.source === "manual"
                                    ? `${m.channel === "call" ? "Call Note" : "Email Note"}`
                                    : `${out ? "To" : "From"}: ${m.counterpartyName || m.counterpartyEmail || "—"}`}
                                </span>
                                <span className="text-[10px] text-slate-500 shrink-0">{formatDate(m.occurredAt)}</span>
                              </div>
                              <div className="text-slate-200 font-semibold truncate">
                                {m.subject || <span className="text-slate-500 italic font-normal">(no subject/note)</span>}
                              </div>
                            </div>
                          </button>
                          {open && (
                            <div className="px-2.5 pb-2.5 pt-1 border-t border-white/5">
                              {m.source !== "manual" && (
                                <div className="text-[10px] text-slate-500 mb-1.5 break-all">
                                  {out ? "→ " : "← "}{m.counterpartyEmail}
                                  {m.counterpartyEmail && (
                                    <a
                                      href={`mailto:${m.counterpartyEmail}`}
                                      className="ml-2 text-indigo-400 hover:text-indigo-300 underline"
                                    >
                                      reply
                                    </a>
                                  )}
                                </div>
                              )}
                              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300 max-h-[220px] overflow-y-auto font-sans">
                                {m.bodyText || <span className="text-slate-600 italic">No description.</span>}
                              </pre>
                              {m.source === "manual" && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteManualComm(m.id);
                                  }}
                                  className="mt-2 text-rose-400 hover:text-rose-300 hover:underline text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                >
                                  Delete Log
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick links */}
              {detailCompany.website && (
                <div className="border-t border-white/5 pt-4">
                  <a
                    href={detailCompany.website}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition cursor-pointer"
                  >
                    <span>Visit Website</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
              </div>
            ) : null}
          </section>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* RIVALS TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "rivals" && (
        <>
          {/* Rivals Metrics */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl flex flex-col border-rose-500/20">
              <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Total Agencies</span>
              <span className="text-3xl font-bold text-white mt-1">
                {rivalsLoading ? "..." : rivalsTotalCount.toLocaleString()}
              </span>
              <div className="text-xs text-slate-400 mt-3 border-t border-white/5 pt-2">
                Web design competitors detected
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl flex flex-col">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Detection Method</span>
              <span className="text-lg font-bold text-slate-300 mt-2">
                Footer Analysis
              </span>
              <div className="text-xs text-slate-400 mt-3 border-t border-white/5 pt-2">
                Made by / Vytvoril / Powered by patterns
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl flex flex-col">
              <span className="text-xs font-medium text-cyan-400 uppercase tracking-wider">Intelligence</span>
              <span className="text-lg font-bold text-slate-300 mt-2">
                Client Mapping
              </span>
              <div className="text-xs text-slate-400 mt-3 border-t border-white/5 pt-2">
                Track which agency built which website
              </div>
            </div>
          </section>

          {/* Rivals Table */}
          <section className="w-full glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/5">
            {/* Controls */}
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search agencies by name or domain..."
                  value={rivalsSearch}
                  onChange={(e) => {
                    setRivalsSearch(e.target.value);
                    setRivalsPage(1);
                  }}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Sort by:</span>
                <select
                  value={rivalsSortBy}
                  onChange={(e) => {
                    setRivalsSortBy(e.target.value);
                    setRivalsPage(1);
                  }}
                  className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-rose-500"
                >
                  <option value="clients_desc">Most Clients</option>
                  <option value="clients_asc">Fewest Clients</option>
                  <option value="name_asc">Name A-Z</option>
                  <option value="name_desc">Name Z-A</option>
                  <option value="recent">Most Recent</option>
                </select>
              </div>
            </div>

            {/* Rivals list */}
            <div className="overflow-x-auto min-h-[300px]">
              {rivalsLoading ? (
                <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-rose-400" />
                  Loading agencies...
                </div>
              ) : rivalsData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-2">
                  <Swords className="h-6 w-6 text-slate-600" />
                  <span>No agencies detected yet.</span>
                  <span className="text-xs text-slate-500">Run the agency detection script to discover web design competitors.</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-white/2">
                      <th className="py-2 px-3">Agency Name</th>
                      <th className="py-2 px-3">Domain</th>
                      <th className="py-2 px-3 text-center">Total Clients</th>
                      <th className="py-2 px-3 text-center">Construction</th>
                      <th className="py-2 px-3 text-center">Status</th>
                      <th className="py-2 px-3 text-right hidden lg:table-cell">First Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm">
                    {rivalsData.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRivalId(r.id)}
                        className={`transition cursor-pointer ${
                          selectedRivalId === r.id
                            ? "bg-rose-500/10 hover:bg-rose-500/15"
                            : "hover:bg-white/3"
                        }`}
                      >
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-100 flex items-center gap-2">
                            <span>{r.name}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {r.domain ? (
                            <a
                              href={`https://${r.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
                            >
                              <Globe className="h-3 w-3" />
                              {r.domain}
                            </a>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-sm font-bold text-white bg-rose-500/15 border border-rose-500/25 px-2.5 py-0.5 rounded-full">
                            {r.totalClients}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="text-xs font-medium text-amber-400">
                            {r.constructionClients}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-xs font-semibold ${
                            r.status === "active" ? "text-emerald-400" : "text-slate-500"
                          }`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-xs text-slate-400 hidden lg:table-cell">
                          {formatDate(r.firstSeen)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-white/5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>
                  Page <span className="font-medium text-slate-200">{rivalsPage}</span> of{" "}
                  <span className="font-medium text-slate-200">{rivalsTotalPages}</span>
                  <span className="ml-2">({rivalsTotalCount} agencies)</span>
                </span>
                <div className="flex items-center gap-1.5 border border-white/10 rounded-lg px-2 py-0.5 bg-white/2">
                  <span>Go to:</span>
                  <input
                    type="text"
                    value={jumpRivalsPageInput}
                    onChange={(e) => setJumpRivalsPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt(jumpRivalsPageInput, 10);
                        if (!isNaN(val) && val >= 1 && val <= rivalsTotalPages) {
                          setRivalsPage(val);
                        } else {
                          setJumpRivalsPageInput(rivalsPage.toString());
                        }
                      }
                    }}
                    className="w-12 bg-transparent text-slate-100 font-semibold text-center focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRivalsPage((p) => Math.max(1, p - 1))}
                  disabled={rivalsPage === 1}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setRivalsPage((p) => Math.min(rivalsTotalPages, p + 1))}
                  disabled={rivalsPage === rivalsTotalPages}
                  className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          {/* Rival Detail Inspector */}
          {selectedRivalId !== null && (
            <section className="fixed bottom-6 right-6 w-[440px] max-h-[85vh] glass-panel rounded-2xl p-5 flex flex-col border border-rose-500/20 shadow-2xl z-50 overflow-y-auto">
              {rivalDetailLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-rose-400" />
                  <span className="text-xs">Loading agency details...</span>
                </div>
              ) : rivalDetail ? (
                <div className="flex-1 flex flex-col gap-5">
                  {/* Header */}
                  <div className="border-b border-white/5 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-extrabold text-lg text-slate-100 leading-tight flex items-center gap-2">
                          <Swords className="h-5 w-5 text-rose-400 flex-shrink-0" />
                          {rivalDetail.name}
                        </h3>
                        {rivalDetail.domain && (
                          <a
                            href={`https://${rivalDetail.domain}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1 mt-1"
                          >
                            <Globe className="h-3 w-3" />
                            {rivalDetail.domain}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => setSelectedRivalId(null)}
                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 cursor-pointer hover:text-rose-400"
                      >
                        <XCircle className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 block">Total Clients</span>
                      <span className="text-2xl font-bold text-rose-400">{rivalDetail.totalClients}</span>
                    </div>
                    <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-500 block">Construction</span>
                      <span className="text-2xl font-bold text-amber-400">{rivalDetail.constructionClients}</span>
                    </div>
                  </div>

                  {/* Client List */}
                  <div className="flex-1 flex flex-col gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Client Companies
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">
                        {rivalClients.length}
                      </span>
                    </h4>
                    <div className="flex-1 overflow-y-auto max-h-[350px] flex flex-col gap-1.5 pr-1">
                      {rivalClients.map((rc) => (
                        <div
                          key={rc.linkId}
                          className="text-xs p-2.5 bg-white/2 border border-white/5 rounded-lg hover:bg-white/5 transition flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-200 truncate">{rc.companyName}</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                rc.detectionMethod === "both"
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                  : rc.detectionMethod === "footer"
                                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                                  : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
                              }`}>
                                {rc.detectionMethod.toUpperCase()}
                              </span>
                              <span className="text-[9px] text-slate-500">{rc.confidenceScore}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400">
                            {rc.companyDomain && (
                              <a
                                href={`https://${rc.companyDomain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400/70 hover:text-cyan-400 flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Globe className="h-3 w-3" />
                                {rc.companyDomain}
                              </a>
                            )}
                            {rc.companyCity && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-3 w-3" />
                                {rc.companyCity}
                              </span>
                            )}
                            {rc.companyRevenue !== null && rc.companyRevenue !== undefined && (
                              <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                                <TrendingUp className="h-3 w-3" />
                                {rc.companyRevenue >= 1000000
                                  ? `${(rc.companyRevenue / 1000000).toFixed(1)}M €`
                                  : `${rc.companyRevenue.toLocaleString()} €`}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {rivalClients.length === 0 && (
                        <div className="text-xs text-slate-600 italic py-4 text-center">No clients detected yet.</div>
                      )}
                    </div>
                  </div>

                  {/* Visit Agency */}
                  {rivalDetail.website && (
                    <div className="border-t border-white/5 pt-4">
                      <a
                        href={rivalDetail.website}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-sm font-semibold text-white transition cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Visit Agency Website</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CRM TAB */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "crm" && (
        <div className="flex-1 flex flex-col gap-6">
          {crmLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
              <span className="text-xs">Načítavam dennú aktivitu...</span>
            </div>
          ) : (() => {
            // Group the logs by day
            const groupedDays = (() => {
              const groups: Record<string, {
                dateStr: string;
                formattedDate: string;
                companies: Record<number, {
                  id: number;
                  name: string;
                  domain: string | null;
                  website: string | null;
                  commCount: number;
                  latestOccurredAt: number;
                  logs: any[];
                }>;
              }> = {};

              const todayStr = toLocalDateValue(new Date());
              const yesterday = new Date();
              yesterday.setDate(yesterday.getDate() - 1);
              const yesterdayStr = toLocalDateValue(yesterday);

              const getFormattedDayLabel = (dateStr: string) => {
                const displayDate = new Date(`${dateStr}T00:00:00`);
                let formattedDate = displayDate.toLocaleDateString("sk-SK", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                });

                if (dateStr === todayStr) {
                  formattedDate = `Dnes (${formattedDate})`;
                } else if (dateStr === yesterdayStr) {
                  formattedDate = `Včera (${formattedDate})`;
                }

                return formattedDate;
              };

              const addLogToGroup = (dateStr: string, log: any, latestOccurredAt: number, logMeta: any = {}) => {
                if (!groups[dateStr]) {
                  groups[dateStr] = {
                    dateStr,
                    formattedDate: getFormattedDayLabel(dateStr),
                    companies: {}
                  };
                }

                if (!groups[dateStr].companies[log.companyId]) {
                  groups[dateStr].companies[log.companyId] = {
                    id: log.companyId,
                    name: log.companyName,
                    domain: log.companyDomain,
                    website: log.companyWebsite,
                    commCount: log.commCount || 0,
                    latestOccurredAt,
                    logs: []
                  };
                }

                groups[dateStr].companies[log.companyId].latestOccurredAt = Math.max(
                  groups[dateStr].companies[log.companyId].latestOccurredAt,
                  latestOccurredAt
                );
                groups[dateStr].companies[log.companyId].logs.push({
                  ...log,
                  ...logMeta,
                });
              };

              crmLogs.forEach(log => {
                const logOutcome = getCrmOutcome(log.subject) || getCrmOutcome(log.note);
                const isWarningLog = logOutcome === "warning";
                const reminderDateValue = logOutcome === "remind" ? parseReminderDateValue(log.note || log.subject) : "";
                const reminderOriginalCallDate = logOutcome === "remind" ? parseReminderOriginalCallDate(log.note || log.subject) : "";
                const sortableLogsForCompany = crmLogs.filter(
                  (item) =>
                    item.companyId === log.companyId &&
                    (getCrmOutcome(item.subject) || getCrmOutcome(item.note)) !== "warning"
                );
                const groupingTimestamp = isWarningLog && sortableLogsForCompany.length > 0
                  ? Math.max(...sortableLogsForCompany.map((item) => item.occurredAt))
                  : log.occurredAt;

                const date = new Date(groupingTimestamp);
                const originalDateStr = toLocalDateValue(date);
                const reminderOriginalDateValue = reminderOriginalCallDate
                  ? parseCompactSkDateValue(reminderOriginalCallDate, reminderDateValue || originalDateStr)
                  : "";
                const dateStr = reminderDateValue || originalDateStr;
                const logMeta = {
                  reminderFollowUpDate: reminderDateValue || null,
                  reminderOriginalCallDate: reminderOriginalCallDate || null,
                  reminderOriginalDate: reminderOriginalDateValue || (reminderDateValue ? originalDateStr : null),
                  reminderOriginalOccurredAt: reminderDateValue ? log.occurredAt : null,
                };

                addLogToGroup(dateStr, log, isWarningLog ? 0 : log.occurredAt, {
                  ...logMeta,
                  reminderTimelineRole: "followup",
                });

                if (
                  logOutcome === "remind" &&
                  reminderOriginalDateValue &&
                  reminderOriginalDateValue !== dateStr
                ) {
                  addLogToGroup(reminderOriginalDateValue, log, log.occurredAt, {
                    ...logMeta,
                    reminderTimelineRole: "created",
                  });
                }
              });

              return Object.values(groups)
                .map((day) => {
                  Object.values(day.companies).forEach((company) => {
                    company.logs.sort((a: any, b: any) => b.occurredAt - a.occurredAt);
                  });
                  return day;
                })
                .sort((a, b) => b.dateStr.localeCompare(a.dateStr));
            })();

            if (groupedDays.length === 0) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-slate-500 gap-3 border border-white/5 rounded-2xl glass-panel">
                  <Clock className="h-8 w-8 text-slate-600" />
                  <div className="text-center">
                    <span className="text-sm font-semibold text-slate-300 block">Zatiaľ žiadna denná aktivita</span>
                    <span className="text-xs text-slate-500 mt-1 block font-normal">Otvorte detail ktorejkoľvek firmy a kliknite na "Add to CRM Today" pre začiatok dňa!</span>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-col gap-6">
                {groupedDays.map((day) => (
                  <section key={day.dateStr} className="w-full glass-panel rounded-2xl overflow-visible flex flex-col border border-white/5">
                    {/* Day Header */}
                    <div className="p-4 bg-slate-950/40 border-b border-white/5 flex items-center justify-between">
                      <h3 className="font-extrabold text-sm text-emerald-400 flex items-center gap-2 capitalize">
                        <Clock className="h-4 w-4" />
                        {day.formattedDate}
                      </h3>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                        {Object.keys(day.companies).length} {Object.keys(day.companies).length === 1 ? "firma" : Object.keys(day.companies).length < 5 ? "firmy" : "firiem"}
                      </span>
                    </div>

                    {/* Table */}
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 bg-slate-900/30 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          <th className="py-2.5 px-4">Firma</th>
                          <th className="py-2.5 px-3">Webstránka</th>
                          <th className="py-2.5 px-3 w-[55%]">História Aktivít / Záznamy</th>
                          <th className="py-2.5 px-4 text-right">Akcie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(day.companies).sort((a, b) => b.latestOccurredAt - a.latestOccurredAt).map((c) => {
                          const isInlineEditing = inlineLogCompanyId === c.id;
                          const isReminderDatePicking = reminderDateCompanyId === c.id;

                          // Determine row color from last call outcome tag
                          const lastOutcome = (() => {
                            for (let i = 0; i < c.logs.length; i++) {
                              const outcome = getCrmOutcome(c.logs[i].subject) || getCrmOutcome(c.logs[i].note);
                              if (outcome === "warning") continue;
                              if (outcome) return outcome;
                            }
                            return null;
                          })();
                          const hasCompanyWarning = c.logs.some((log: any) => (getCrmOutcome(log.subject) || getCrmOutcome(log.note)) === "warning");
                          const nextDayLeadKind = (() => {
                            const leadLog = c.logs.find((log: any) => log.channel === "view" && String(log.note || log.subject || "").includes("[NEXT_DAY_LEAD]"));
                            const text = String(leadLog?.note || leadLog?.subject || "");
                            if (text.includes("[STAR:coming]")) return "coming";
                            if (text.includes("[HEART:broken]")) return "broken";
                            return leadLog ? "regular" : null;
                          })();

                          const rowBg = lastOutcome === "remind"
                            ? "bg-amber-500/8 border-l-2 border-l-amber-400"
                            : lastOutcome === "noanswer"
                            ? "bg-slate-500/8 border-l-2 border-l-slate-500"
                            : lastOutcome === "interest"
                            ? "bg-emerald-500/8 border-l-2 border-l-emerald-400"
                            : lastOutcome === "decline"
                            ? "bg-rose-500/8 border-l-2 border-l-rose-400"
                            : "";

                          const rowHoverBg = lastOutcome === "remind"
                            ? "hover:bg-amber-500/12"
                            : lastOutcome === "noanswer"
                            ? "hover:bg-slate-500/12"
                            : lastOutcome === "interest"
                            ? "hover:bg-emerald-500/12"
                            : lastOutcome === "decline"
                            ? "hover:bg-rose-500/12"
                            : "hover:bg-white/3";

                          return (
                            <tr
                              key={c.id}
                              className={`border-b border-white/5 transition group ${rowBg} ${rowHoverBg}`}
                            >
                              {/* Company Name */}
                              <td className="py-1.5 px-4 font-semibold text-slate-100">
                                <button
                                  onClick={() => setSelectedCompanyId(c.id)}
                                  className="hover:text-indigo-400 hover:underline cursor-pointer transition text-left"
                                >
                                  {c.name}
                                </button>
                                {nextDayLeadKind && (
                                  <span className={`ml-2 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] font-bold ${
                                    nextDayLeadKind === "coming"
                                      ? "border-orange-400/30 bg-orange-500/15 text-orange-200"
                                      : nextDayLeadKind === "broken"
                                      ? "border-slate-500 bg-slate-950 text-slate-100"
                                      : "border-rose-400/25 bg-rose-500/10 text-rose-200"
                                  }`}>
                                    {nextDayLeadKind === "coming" ? (
                                      <span>★?</span>
                                    ) : nextDayLeadKind === "broken" ? (
                                      <span>♥!</span>
                                    ) : (
                                      <Heart className="h-2.5 w-2.5" />
                                    )}
                                    {nextDayLeadKind === "coming" ? "COMING" : nextDayLeadKind === "broken" ? "BROKEN" : "NEW"}
                                  </span>
                                )}
                                {(c.commCount ?? 0) > 0 && (
                                  <span
                                    title={`${c.commCount} emails on record`}
                                    className="ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 select-none inline-flex items-center gap-0.5 align-middle"
                                  >
                                    <Mail className="h-2.5 w-2.5" />
                                    {c.commCount}
                                  </span>
                                )}
                                {hasCompanyWarning && (
                                  <span className="relative ml-1">
                                    <button
                                      type="button"
                                      title="Pozor: nepríjemná komunikácia"
                                      className="text-yellow-300 cursor-pointer"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setWarningMenuCompanyId(warningMenuCompanyId === c.id ? null : c.id);
                                      }}
                                    >
                                      ⚠️
                                    </button>
                                    {warningMenuCompanyId === c.id && (
                                      <div className="absolute left-0 top-full mt-1 z-[80] w-36 rounded-lg border border-yellow-400/30 bg-slate-950 p-1 shadow-xl">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveWarning(c.id);
                                          }}
                                          className="w-full rounded px-2 py-1 text-left text-[11px] font-semibold text-rose-300 hover:bg-white/5"
                                        >
                                          Remove warning
                                        </button>
                                      </div>
                                    )}
                                  </span>
                                )}
                              </td>

                              {/* Website */}
                              <td className="py-1.5 px-3">
                                {c.domain ? (
                                  <a
                                    href={c.website || `https://${c.domain}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium text-xs flex items-center gap-1 inline-flex"
                                  >
                                    {c.domain}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-slate-600">—</span>
                                )}
                              </td>

                              {/* Activity Logs List */}
                              <td className="py-1 px-3">
                                <div className="flex flex-col gap-1">
                                  {(() => {
                                    const nextDayLeadKind = (() => {
                                      const leadLog = c.logs.find((log: any) => log.channel === "view" && String(log.note || log.subject || "").includes("[NEXT_DAY_LEAD]"));
                                      const text = String(leadLog?.note || leadLog?.subject || "");
                                      if (text.includes("[STAR:coming]")) return "coming";
                                      if (text.includes("[HEART:broken]")) return "broken";
                                      return leadLog ? "regular" : null;
                                    })();
                                    const manualLogs = c.logs.filter((log: any) => {
                                      if (log.channel === "view") return false;
                                      return (getCrmOutcome(log.subject) || getCrmOutcome(log.note)) !== "warning";
                                    });

                                    if (manualLogs.length === 0) {
                                      return (
                                        nextDayLeadKind ? (
                                          <span className={`inline-flex w-fit items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold select-none ${
                                            nextDayLeadKind === "coming"
                                              ? "border-orange-400/30 bg-orange-500/15 text-orange-200"
                                              : nextDayLeadKind === "broken"
                                              ? "border-slate-500 bg-slate-950 text-slate-100"
                                              : "border-rose-400/25 bg-rose-500/10 text-rose-200"
                                          }`}>
                                            {nextDayLeadKind === "coming" ? (
                                              <span>★?</span>
                                            ) : nextDayLeadKind === "broken" ? (
                                              <span>♥!</span>
                                            ) : (
                                              <Heart className="h-3 w-3" />
                                            )}
                                            {nextDayLeadKind === "coming" ? "New site coming" : nextDayLeadKind === "broken" ? "Broken website" : "New lead"}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] text-slate-600 italic select-none">
                                            Pridané do plánu (zatiaľ bez hovoru/e-mailu)
                                          </span>
                                        )
                                      );
                                    }

                                    return manualLogs.map((log: any) => {
                                      const logTime = new Date(log.occurredAt).toLocaleTimeString("sk-SK", {
                                        hour: "2-digit",
                                        minute: "2-digit"
                                      });
                                      const logOutcome = getCrmOutcome(log.subject) || getCrmOutcome(log.note);
                                      const visibleLogNote = cleanCrmLogNote(log.note || log.subject);
                                      const reminderLogDateValue = parseReminderDateValue(log.note || log.subject);
                                      const reminderLogNoteText = parseReminderNoteText(log.note || log.subject);
                                      const activeReminderNoteText =
                                        editingReminderLogId === log.id ? editingLogText : reminderLogNoteText;
                                      const showReminderFollowUpNote =
                                        logOutcome === "remind" &&
                                        log.reminderTimelineRole !== "created" &&
                                        log.reminderFollowUpDate &&
                                        (log.reminderOriginalCallDate || (log.reminderOriginalDate && log.reminderFollowUpDate !== log.reminderOriginalDate));
                                      const reminderOriginalCallLabel =
                                        log.reminderOriginalCallDate || formatCompactSkDate(log.reminderOriginalOccurredAt);

                                      return (
                                        <div key={log.id} className="text-xs flex items-center justify-between gap-2 bg-white/2 border border-white/5 rounded-md px-1.5 py-1 w-full group/log">
                                          <div
                                            className="flex items-center gap-2 flex-1 min-w-0 cursor-text"
                                            onClick={() => {
                                              if (logOutcome !== "remind") {
                                                setEditingLogId(log.id);
                                                setEditingLogText(visibleLogNote);
                                              }
                                            }}
                                          >
                                            {logOutcome !== "warning" && (
                                              editingLogTimeId === log.id ? (
                                                <input
                                                  type="datetime-local"
                                                  value={editingLogTimeValue}
                                                  onChange={(e) => setEditingLogTimeValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSaveCrmLogTime(log.id, c.id);
                                                    if (e.key === "Escape") setEditingLogTimeId(null);
                                                  }}
                                                  onBlur={() => handleSaveCrmLogTime(log.id, c.id)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="w-[150px] shrink-0 bg-slate-950 border border-white/10 rounded px-1 py-0.5 text-[10px] text-slate-100 focus:outline-none focus:border-indigo-500"
                                                  autoFocus
                                                />
                                              ) : (
                                                <button
                                                  type="button"
                                                  className="text-[10px] shrink-0 text-slate-500 font-semibold hover:text-indigo-300 cursor-pointer"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingLogTimeId(log.id);
                                                    setEditingLogTimeValue(toLocalDateTimeValue(log.occurredAt));
                                                  }}
                                                  title="Upraviť čas"
                                                >
                                                  {logTime}
                                                </button>
                                              )
                                            )}
                                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                              {logOutcome === "interest" ? (
                                                <span className="flex items-center gap-0.5 text-emerald-300 shrink-0" title="Poslať mail po hovore">
                                                  <Phone className="h-3 w-3" />
                                                  <ArrowUpRight className="h-2.5 w-2.5" />
                                                  <Mail className="h-3 w-3" />
                                                </span>
                                              ) : logOutcome === "decline" ? (
                                                <span className="text-rose-300 shrink-0 font-bold" title="Odmietol">❌</span>
                                              ) : logOutcome === "warning" ? (
                                                <span className="text-yellow-300 shrink-0 font-bold" title="Pozor: nepríjemná komunikácia">⚠️</span>
                                              ) : log.channel === "call" ? (
                                                <span className="text-indigo-400 shrink-0 font-bold">📞</span>
                                              ) : (
                                                <span className="text-sky-400 shrink-0 font-bold">✉️</span>
                                              )}
                                              <div className="flex flex-col flex-1 min-w-0">
                                                {logOutcome === "remind" ? (
                                                  <div className="flex flex-col gap-0.5">
                                                    {showReminderFollowUpNote && (
                                                      <span className="text-[10px] font-semibold text-amber-200/90">
                                                        Mal som sa ozvať, volali sme {reminderOriginalCallLabel}
                                                      </span>
                                                    )}
                                                    <div className="grid grid-cols-[132px_minmax(0,1fr)] gap-1.5 w-full">
                                                      <div className="relative">
                                                        <button
                                                          type="button"
                                                          className="w-full flex items-center gap-1.5 text-left text-amber-100 font-semibold cursor-pointer hover:text-amber-300 transition truncate"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            openReminderLogDatePicker(log.id, log.note || log.subject);
                                                          }}
                                                          title="Kliknite pre výber dátumu"
                                                        >
                                                          <CalendarDays className="h-3 w-3 shrink-0 text-amber-300" />
                                                          <span className="truncate">
                                                            {reminderLogDateValue ? formatReminderDate(reminderLogDateValue) : ""}
                                                          </span>
                                                        </button>
                                                        {openReminderCalendarLogId === log.id && (
                                                          <ReminderDatePicker
                                                            value={editingReminderDateValue}
                                                            onChange={(dateValue) => {
                                                              setEditingReminderDateValue(dateValue);
                                                              handleSaveReminderLog(log.id, c.id, dateValue, activeReminderNoteText);
                                                            }}
                                                          />
                                                        )}
                                                      </div>
                                                      <input
                                                        type="text"
                                                        value={editingReminderLogId === log.id ? editingLogText : reminderLogNoteText}
                                                        placeholder="Poznámka..."
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          if (editingReminderLogId !== log.id) {
                                                            openReminderLogNoteEditor(log.id, log.note || log.subject);
                                                          }
                                                        }}
                                                        onChange={(e) => {
                                                          setEditingLogText(e.target.value);
                                                          if (editingReminderLogId !== log.id) {
                                                            setEditingReminderLogId(log.id);
                                                            setOpenReminderCalendarLogId(null);
                                                            setEditingReminderDateValue(reminderLogDateValue || getTomorrowDateValue());
                                                          }
                                                        }}
                                                        onKeyDown={(e) => {
                                                          if (e.key === "Enter") handleSaveReminderLog(log.id, c.id, editingReminderDateValue, parseReminderNoteText(editingLogText));
                                                          if (e.key === "Escape") setEditingReminderLogId(null);
                                                        }}
                                                        onBlur={() => {
                                                          if (editingReminderLogId === log.id) handleSaveReminderLog(log.id, c.id, editingReminderDateValue, parseReminderNoteText(editingLogText));
                                                        }}
                                                        className="w-full bg-transparent border-0 px-1 py-0 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:text-amber-100"
                                                      />
                                                    </div>
                                                  </div>
                                                ) : editingLogId === log.id ? (
                                                  <input
                                                    type="text"
                                                    value={editingLogText}
                                                    onChange={(e) => setEditingLogText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") handleSaveCrmLogNote(log.id, c.id, editingLogText);
                                                      if (e.key === "Escape") setEditingLogId(null);
                                                    }}
                                                    onBlur={() => handleSaveCrmLogNote(log.id, c.id, editingLogText)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <button
                                                    type="button"
                                                    className="w-full text-left text-slate-100 font-medium cursor-text hover:text-indigo-300 transition truncate"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setEditingLogId(log.id);
                                                      setEditingLogText(visibleLogNote);
                                                    }}
                                                    title="Kliknite pre úpravu"
                                                  >
                                                    {visibleLogNote || "Kliknite a napíšte poznámku"}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => handleDeleteCrmLog(log.id, c.id)}
                                            className="opacity-0 group-hover/log:opacity-100 transition p-0.5 text-slate-500 hover:text-rose-400 flex-shrink-0 cursor-pointer"
                                            title="Vymazať záznam"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-1 px-3 text-right">
                                {isReminderDatePicking ? (
                                  <div className="flex justify-end min-w-[430px]">
                                    <div className="flex gap-1.5 items-center w-full">
                                      <div className="relative w-32 shrink-0">
                                        <button
                                          type="button"
                                          className="w-full flex items-center gap-1.5 bg-slate-950 border border-amber-400/40 rounded px-2 py-1 text-xs text-amber-100 text-left hover:border-amber-300 focus:outline-none"
                                        >
                                          <CalendarDays className="h-3 w-3 text-amber-300 shrink-0" />
                                          <span>{reminderDateValue ? formatReminderDate(reminderDateValue) : "Dátum"}</span>
                                        </button>
                                        <ReminderDatePicker
                                          value={reminderDateValue}
                                          onChange={(dateValue) => setReminderDateValue(dateValue)}
                                        />
                                      </div>
                                      <input
                                        type="text"
                                        value={reminderNoteValue}
                                        onChange={(e) => setReminderNoteValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSaveReminderDate(c.id);
                                          if (e.key === "Escape") {
                                            setReminderDateCompanyId(null);
                                            setReminderDateValue("");
                                            setReminderNoteValue("");
                                          }
                                        }}
                                        placeholder="Poznámka..."
                                        className="bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-400 w-full"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveReminderDate(c.id)}
                                        className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition cursor-pointer"
                                      >
                                        Uložiť
                                      </button>
                                      <button
                                        onClick={() => {
                                          setReminderDateCompanyId(null);
                                          setReminderDateValue("");
                                          setReminderNoteValue("");
                                        }}
                                        className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-rose-400"
                                      >
                                        Zrušiť
                                      </button>
                                    </div>
                                  </div>
                                ) : isInlineEditing ? (
                                  <div className="flex justify-end min-w-[420px]">
                                    <div className="flex gap-1.5 items-center w-full">
                                      <input
                                        type="text"
                                        placeholder="Zápis z hovoru / e-mailu..."
                                        value={inlineLogNote}
                                        onChange={(e) => setInlineLogNote(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") handleSaveInlineLog(c.id);
                                          if (e.key === "Escape") setInlineLogCompanyId(null);
                                        }}
                                        className="bg-slate-950 border border-white/10 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 w-full"
                                        autoFocus
                                      />
                                      <button
                                        onClick={() => handleSaveInlineLog(c.id)}
                                        className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 transition cursor-pointer"
                                      >
                                        Uložiť
                                      </button>
                                      <button
                                        onClick={() => {
                                          setInlineLogCompanyId(null);
                                          setInlineLogType(null);
                                        }}
                                        className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-rose-400"
                                      >
                                        Zrušiť
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    {/* Phone with hover popup */}
                                    <div className="relative group/phone">
                                      <button
                                        onClick={() => {
                                          setInlineLogCompanyId(c.id);
                                          setInlineLogType("call");
                                          setInlineLogNote("");
                                        }}
                                        className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                                        title="Pridať hovor"
                                      >
                                        <Phone className="h-4 w-4" />
                                      </button>
                                      {/* Quick outcome popup */}
                                      <div className="absolute bottom-full right-0 pb-1 hidden group-hover/phone:flex flex-col gap-0.5 z-50">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleQuickCallLog(c.id, "interest"); }}
                                          className="flex items-center justify-center px-2.5 py-1 rounded-md bg-emerald-600/90 hover:bg-emerald-500 text-white whitespace-nowrap transition cursor-pointer shadow-lg"
                                          title="Záujem"
                                          aria-label="Záujem"
                                        >
                                          <CheckCircle2 className="h-3 w-3" />
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleQuickCallLog(c.id, "noanswer"); }}
                                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-600/90 hover:bg-slate-500 text-white text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-lg"
                                          title="Nezdvihol"
                                        >
                                          <span>📵</span> Nezdvihol
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleQuickCallLog(c.id, "decline"); }}
                                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-lg"
                                          title="Odmietol"
                                        >
                                          <span>❌</span> Odmietol
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleQuickCallLog(c.id, "warning"); }}
                                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-yellow-500/90 hover:bg-yellow-400 text-slate-950 text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-lg"
                                          title="Pozor: nepríjemná komunikácia"
                                        >
                                          <span>⚠️</span> Pozor
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); openReminderDatePicker(c.id); }}
                                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/90 hover:bg-amber-400 text-white text-[10px] font-bold whitespace-nowrap transition cursor-pointer shadow-lg"
                                          title="Pripomenúť ďalší deň"
                                        >
                                          <span>🔔</span> Pripomenúť ďalší deň
                                        </button>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setInlineLogCompanyId(c.id);
                                        setInlineLogType("email");
                                        setInlineLogNote("");
                                      }}
                                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-sky-400 hover:text-sky-300 transition cursor-pointer"
                                      title="Pridať e-mail"
                                    >
                                      <Mail className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setSelectedCompanyId(c.id)}
                                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 hover:text-white transition cursor-pointer"
                                      title="Otvoriť detail"
                                    >
                                      <Building className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveCompanyFromCRM(c.id, day.dateStr)}
                                      className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                      title="Odstrániť z CRM"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      </main>
    </div>
  );
}
