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
  Palette,
  Wrench
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

export default function Dashboard() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"companies" | "rivals">("companies");

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
  const [legalForm, setLegalForm] = useState("");
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

  // Fetch companies paginated & filtered
  const fetchCompanies = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
            c.id === detailCompany.id
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
        setDetailComms((prev) => prev.filter((item) => item.id !== commId));
        setCompanies((prev) =>
          prev.map((c) =>
            c.id === detailCompany.id
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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 flex items-center gap-2">
            Eagle Eye <span className="text-xs font-semibold px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-400 bg-indigo-500/5 uppercase">Slovak B2B CRM</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Website Intelligence and scoring for construction & plumbing companies
          </p>
        </div>

        {/* Crawl batch trigger */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {crawlProgressMessage && (
            <div className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-3 py-2 rounded-lg flex items-center gap-2 max-w-xs animate-pulse">
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>{crawlProgressMessage}</span>
            </div>
          )}
          <button
            onClick={handleBatchCrawl}
            disabled={isCrawlingBatch}
            className="glass-panel px-4 py-2 text-sm font-medium rounded-lg text-indigo-300 hover:text-white flex items-center justify-center gap-2 glass-card-hover cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isCrawlingBatch ? "animate-spin" : ""}`} />
            Run Batch Crawl (20)
          </button>
        </div>
      </header>

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
      </nav>



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

              {/* Legal Form Selector */}
              <div className="flex flex-col gap-1.5 self-start lg:self-auto">
                <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Legal Form</label>
                <div className="flex bg-slate-950/60 p-0.5 rounded-lg border border-white/10 select-none">
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
                    Companies (s.r.o.)
                  </button>
                  <button
                    onClick={() => { setLegalForm("sole_trader"); setPage(1); }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                      legalForm === "sole_trader"
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Sole Traders (Živnosti)
                  </button>
                </div>
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
                      className={`transition cursor-pointer ${
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
                          {c.finstatRank && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-0.5 select-none flex-shrink-0">
                              🏆 #{c.finstatRank}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-3">
                        {c.domain ? (
                          <a
                            href={c.website || `https://${c.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-indigo-400 hover:text-indigo-300 hover:underline font-medium text-xs flex items-center gap-1 inline-flex"
                          >
                            <span>{c.domain}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
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
              </div>

              {/* Financial Data (if matched from FinStat) */}
              {detailCompany.revenue !== null && detailCompany.revenue !== undefined && (
                <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Financial Intelligence</h4>
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
                  <div className="text-[9px] text-slate-600 text-right mt-0.5">Source: FinStat ({detailCompany.financialYear})</div>
                </div>
              )}

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
      </main>
    </div>
  );
}
