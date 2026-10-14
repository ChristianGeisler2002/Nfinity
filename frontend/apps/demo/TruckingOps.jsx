import { useState, useEffect, useRef } from "react";

// ─── DESIGN SYSTEM ────────────────────────────────────────────────────────────
// Aesthetic: Industrial/Utilitarian — slate backgrounds, amber accents,
// mono data typography, tight grids, operational density.
// Fonts: "DM Mono" for data, "Barlow Condensed" for headers

const FONT_LINK = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
`;

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const LOADS = [
  { id: "LD-4821", broker: "Echo Global", origin: "Chicago, IL", dest: "Atlanta, GA", driver: "Marcus Webb", truck: "T-14", rate: 4200, miles: 718, status: "In Transit", eta: "Today 6:30 PM", stage: "transit", profit: 1140, margin: 27 },
  { id: "LD-4822", broker: "Coyote Logistics", origin: "Dallas, TX", dest: "Phoenix, AZ", driver: "Jorge Reyes", truck: "T-07", rate: 3850, miles: 1063, status: "POD Needed", eta: "Delivered", stage: "pod", profit: 980, margin: 25 },
  { id: "LD-4823", broker: "XPO Brokerage", origin: "Memphis, TN", dest: "Charlotte, NC", driver: "Darnell King", truck: "T-22", rate: 2900, miles: 526, status: "Invoice Ready", eta: "Delivered", stage: "invoice", profit: 720, margin: 24 },
  { id: "LD-4824", broker: "Convoy", origin: "Columbus, OH", dest: "Pittsburgh, PA", driver: "Sandra Liu", truck: "T-09", rate: 1650, miles: 188, status: "Rate Con Received", eta: "Tomorrow 8:00 AM", stage: "ratecon", profit: 410, margin: 24 },
  { id: "LD-4825", broker: "Total Quality", origin: "Kansas City, MO", dest: "Denver, CO", driver: "Unassigned", truck: "—", rate: 3200, miles: 602, status: "Awaiting Driver", eta: "TBD", stage: "ratecon", profit: 850, margin: 26 },
  { id: "LD-4826", broker: "Echo Global", origin: "Louisville, KY", dest: "Nashville, TN", driver: "Tony Marsh", truck: "T-03", rate: 1400, miles: 176, status: "Paid", eta: "Delivered", stage: "paid", profit: 310, margin: 22 },
];

const DRIVERS = [
  { id: "D-01", name: "Marcus Webb", cdl: "2025-11-14", med: "2026-03-20", status: "Driving", load: "LD-4821", location: "Indianapolis, IN", hoursLeft: 6.5, truck: "T-14" },
  { id: "D-02", name: "Jorge Reyes", cdl: "2024-12-09", med: "2025-06-15", status: "Waiting", load: "LD-4822", location: "Phoenix, AZ", hoursLeft: 9.0, truck: "T-07" },
  { id: "D-03", name: "Darnell King", cdl: "2026-07-22", med: "2026-01-10", status: "Delivered", load: "LD-4823", location: "Charlotte, NC", hoursLeft: 11.0, truck: "T-22" },
  { id: "D-04", name: "Sandra Liu", cdl: "2026-04-18", med: "2026-05-30", status: "Available", load: "—", location: "Columbus, OH", hoursLeft: 11.0, truck: "T-09" },
  { id: "D-05", name: "Tony Marsh", cdl: "2025-09-03", med: "2025-08-11", status: "Offline", load: "—", location: "Louisville, KY", hoursLeft: 0, truck: "T-03" },
];

const COMPLIANCE = [
  { item: "CDL — Jorge Reyes", type: "CDL", expires: "2024-12-09", daysLeft: -148, severity: "red" },
  { item: "Medical Card — Tony Marsh", type: "Medical", expires: "2025-08-11", daysLeft: 22, severity: "red" },
  { item: "CDL — Marcus Webb", type: "CDL", expires: "2025-11-14", daysLeft: 117, severity: "yellow" },
  { item: "IFTA Q2 Filing", type: "IFTA", expires: "2025-07-31", daysLeft: 49, severity: "yellow" },
  { item: "IRP Renewal", type: "IRP", expires: "2025-12-31", daysLeft: 204, severity: "green" },
  { item: "Insurance Policy", type: "Insurance", expires: "2026-01-15", daysLeft: 220, severity: "green" },
];

const INVOICES = [
  { id: "INV-2241", load: "LD-4823", broker: "XPO Brokerage", amount: 2900, status: "Draft", daysOut: 0 },
  { id: "INV-2238", load: "LD-4819", broker: "Coyote Logistics", amount: 4100, status: "Sent", daysOut: 3 },
  { id: "INV-2231", load: "LD-4811", broker: "Echo Global", amount: 2650, status: "Overdue", daysOut: 18 },
  { id: "INV-2229", load: "LD-4808", broker: "Convoy", amount: 1950, status: "Viewed", daysOut: 7 },
  { id: "INV-2220", load: "LD-4800", broker: "Total Quality", amount: 3400, status: "Paid", daysOut: 12 },
];

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⬛" },
  { id: "loads", label: "Loads", icon: "📦" },
  { id: "drivers", label: "Drivers & Trucks", icon: "🚛" },
  { id: "compliance", label: "Compliance", icon: "🛡" },
  { id: "documents", label: "Documents", icon: "📄" },
  { id: "invoicing", label: "Invoicing", icon: "💵" },
  { id: "profitability", label: "Profitability", icon: "📈" },
  { id: "crm", label: "CRM / Contacts", icon: "🤝" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

// ─── UTILS ────────────────────────────────────────────────────────────────────
function cx(...classes) { return classes.filter(Boolean).join(" "); }

function Badge({ children, color = "slate" }) {
  const colors = {
    green: "bg-emerald-900/60 text-emerald-300 border border-emerald-700/50",
    yellow: "bg-amber-900/60 text-amber-300 border border-amber-700/50",
    red: "bg-red-900/60 text-red-300 border border-red-700/50",
    blue: "bg-blue-900/60 text-blue-300 border border-blue-700/50",
    slate: "bg-slate-700/60 text-slate-300 border border-slate-600/50",
    orange: "bg-orange-900/60 text-orange-300 border border-orange-700/50",
  };
  return (
    <span className={cx("px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wide", colors[color])}>
      {children}
    </span>
  );
}

function StatCard({ label, value, sub, color = "default", size = "normal" }) {
  const accents = {
    default: "border-slate-700",
    amber: "border-amber-500/50",
    red: "border-red-500/50",
    green: "border-emerald-500/50",
    blue: "border-blue-500/50",
  };
  const valueColors = {
    default: "text-slate-100",
    amber: "text-amber-400",
    red: "text-red-400",
    green: "text-emerald-400",
    blue: "text-blue-400",
  };
  return (
    <div className={cx("bg-slate-800/80 border-l-2 border rounded-sm p-4 flex flex-col gap-1", accents[color])}>
      <div className="text-slate-500 text-xs font-mono uppercase tracking-widest">{label}</div>
      <div className={cx("font-mono font-bold", size === "large" ? "text-3xl" : "text-2xl", valueColors[color])}>{value}</div>
      {sub && <div className="text-slate-500 text-xs font-mono">{sub}</div>}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 3000);
    return () => clearInterval(t);
  }, []);

  const revenueToday = (tick % 2 === 0) ? "$18,450" : "$18,450";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Operations Dashboard</h1>
          <p className="text-slate-500 font-mono text-xs mt-0.5">Friday May 9, 2025 — Live View</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 font-mono text-xs">SYSTEM LIVE</span>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Active Loads" value="4" sub="2 in transit" color="amber" />
        <StatCard label="Revenue Today" value="$18,450" sub="↑ 12% vs last Fri" color="green" />
        <StatCard label="Loads Awaiting POD" value="1" sub="LD-4822" color="red" />
        <StatCard label="Outstanding Invoices" value="$8,700" sub="3 invoices open" color="blue" />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Weekly Rev Est." value="$62,400" sub="6 loads this week" />
        <StatCard label="Est. Weekly Profit" value="$16,240" sub="~26% avg margin" color="green" />
        <StatCard label="Loads Delayed" value="0" sub="All on schedule" color="green" />
        <StatCard label="Drivers Available" value="1" sub="Sandra Liu" color="amber" />
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-2 gap-4">

        {/* Dispatch Operations */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-sm p-5 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 pb-2">Dispatch Operations</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-slate-400">Dispatcher / Truck Ratio</span>
              <span className="font-mono text-lg text-amber-400 font-bold">1:8</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-slate-400">Check Calls Prevented</span>
              <span className="font-mono text-lg text-emerald-400 font-bold">24 today</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-slate-400">Est. Labor Hours Saved</span>
              <span className="font-mono text-lg text-emerald-400 font-bold">6.0 hrs</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-slate-400">Active Issues</span>
              <span className="font-mono text-lg text-red-400 font-bold">2</span>
            </div>
          </div>
        </div>

        {/* Compliance Alerts */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-sm p-5 space-y-3">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 pb-2">Compliance Alerts</div>
          <div className="space-y-2">
            {COMPLIANCE.filter(c => c.severity !== "green").map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="font-mono text-sm text-slate-300">{c.item}</span>
                <Badge color={c.severity}>{c.daysLeft < 0 ? "EXPIRED" : `${c.daysLeft}d`}</Badge>
              </div>
            ))}
            <div className="pt-1 border-t border-slate-700">
              <span className="font-mono text-xs text-slate-500">3 items green — No immediate action needed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Activity Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Fleet Activity</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Load ID</th>
              <th className="text-left p-3">Driver</th>
              <th className="text-left p-3">Route</th>
              <th className="text-left p-3">Rate</th>
              <th className="text-left p-3">ETA</th>
              <th className="text-left p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {LOADS.map((load, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="p-3 text-amber-400">{load.id}</td>
                <td className="p-3 text-slate-200">{load.driver}</td>
                <td className="p-3 text-slate-400">{load.origin} → {load.dest}</td>
                <td className="p-3 text-emerald-400">${load.rate.toLocaleString()}</td>
                <td className="p-3 text-slate-300">{load.eta}</td>
                <td className="p-3">
                  <Badge color={
                    load.stage === "paid" ? "green" :
                    load.stage === "invoice" ? "blue" :
                    load.stage === "pod" ? "red" :
                    load.stage === "transit" ? "amber" : "slate"
                  }>{load.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Snapshot */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Outstanding Invoices" value="$8,700" color="red" />
        <StatCard label="Est. Factoring Cost" value="$261" sub="3% on $8,700" color="red" />
        <StatCard label="Detention Owed" value="$350" sub="LD-4822 — 3.5hrs" color="amber" />
        <StatCard label="Weekly Op. Loss Est." value="$0" sub="No delays flagged" color="green" />
      </div>
    </div>
  );
}

// ─── LOADS PIPELINE ───────────────────────────────────────────────────────────
function Loads() {
  const stages = [
    { key: "ratecon", label: "Rate Con Received", color: "border-slate-500" },
    { key: "transit", label: "In Transit", color: "border-amber-500" },
    { key: "pod", label: "POD Needed", color: "border-red-500" },
    { key: "invoice", label: "Invoice Ready", color: "border-blue-500" },
    { key: "paid", label: "Paid", color: "border-emerald-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Load Pipeline</h1>
          <p className="text-slate-500 font-mono text-xs mt-0.5">Kanban workflow — {LOADS.length} active loads</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-mono text-sm font-bold rounded-sm transition-colors">
          + NEW LOAD
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3 overflow-x-auto">
        {stages.map(stage => {
          const stageLoads = LOADS.filter(l => l.stage === stage.key);
          return (
            <div key={stage.key} className="min-w-0">
              <div className={cx("border-t-2 bg-slate-800/50 border border-t-current rounded-sm", stage.color)}>
                <div className="p-3 border-b border-slate-700">
                  <div className="text-xs font-mono uppercase tracking-widest text-slate-400">{stage.label}</div>
                  <div className="text-lg font-mono font-bold text-slate-100 mt-0.5">{stageLoads.length}</div>
                </div>
                <div className="p-2 space-y-2 min-h-24">
                  {stageLoads.map(load => (
                    <div key={load.id} className="bg-slate-700/60 border border-slate-600/50 rounded-sm p-3 space-y-2 hover:border-slate-500 transition-colors cursor-pointer">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-amber-400 text-xs font-bold">{load.id}</span>
                        <span className="font-mono text-emerald-400 text-xs">${load.rate.toLocaleString()}</span>
                      </div>
                      <div className="font-mono text-xs text-slate-300 leading-tight">{load.origin}<br/>→ {load.dest}</div>
                      <div className="font-mono text-xs text-slate-500">{load.broker}</div>
                      {load.driver !== "Unassigned" && load.driver !== "—" && (
                        <div className="font-mono text-xs text-slate-400">{load.driver}</div>
                      )}
                      {load.driver === "Unassigned" && (
                        <div className="font-mono text-xs text-red-400">⚠ No driver</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Load Detail Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4 flex justify-between">
          <span>All Loads</span>
          <span className="text-amber-400">Upload Rate Con →</span>
        </div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Load</th>
              <th className="text-left p-3">Broker</th>
              <th className="text-left p-3">Driver / Truck</th>
              <th className="text-left p-3">Miles</th>
              <th className="text-left p-3">Rate</th>
              <th className="text-left p-3">Profit</th>
              <th className="text-left p-3">Margin</th>
              <th className="text-left p-3">ETA</th>
            </tr>
          </thead>
          <tbody>
            {LOADS.map((load, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer">
                <td className="p-3 text-amber-400">{load.id}</td>
                <td className="p-3 text-slate-300">{load.broker}</td>
                <td className="p-3 text-slate-400">{load.driver} / {load.truck}</td>
                <td className="p-3 text-slate-400">{load.miles}</td>
                <td className="p-3 text-slate-200">${load.rate.toLocaleString()}</td>
                <td className="p-3 text-emerald-400">${load.profit.toLocaleString()}</td>
                <td className="p-3">
                  <span className={cx("font-mono", load.margin >= 25 ? "text-emerald-400" : load.margin >= 20 ? "text-amber-400" : "text-red-400")}>
                    {load.margin}%
                  </span>
                </td>
                <td className="p-3 text-slate-400">{load.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DRIVERS & TRUCKS ─────────────────────────────────────────────────────────
function DriversAndTrucks() {
  const [detention, setDetention] = useState(210); // minutes
  useEffect(() => {
    const t = setInterval(() => setDetention(d => d + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const statusColor = (s) => ({
    Driving: "green", Waiting: "yellow", Delivered: "blue",
    Available: "amber", Offline: "slate"
  }[s] || "slate");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Drivers & Trucks</h1>
          <p className="text-slate-500 font-mono text-xs mt-0.5">Real-time status — {DRIVERS.length} drivers</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 font-mono text-xs">SIMULATED LIVE</span>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Driving" value="1" color="green" />
        <StatCard label="Waiting / Delivered" value="2" color="amber" />
        <StatCard label="Available" value="1" color="blue" />
        <StatCard label="Detention Accumulating" value="3h 30m" sub="LD-4822 — Est. $350" color="red" />
      </div>

      {/* Driver Cards */}
      <div className="grid grid-cols-3 gap-4">
        {DRIVERS.map(driver => {
          const cdlDate = new Date(driver.cdl);
          const now = new Date("2025-05-09");
          const cdlDays = Math.round((cdlDate - now) / 86400000);
          const cdlAlert = cdlDays < 30;
          const medDate = new Date(driver.med);
          const medDays = Math.round((medDate - now) / 86400000);
          const medAlert = medDays < 60;

          return (
            <div key={driver.id} className="bg-slate-800/80 border border-slate-700 rounded-sm p-4 space-y-3 hover:border-slate-500 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-barlow font-bold text-slate-100 text-lg uppercase">{driver.name}</div>
                  <div className="font-mono text-xs text-slate-500">{driver.id} — {driver.truck}</div>
                </div>
                <Badge color={statusColor(driver.status)}>{driver.status}</Badge>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Current Load</span>
                  <span className="text-amber-400">{driver.load}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location</span>
                  <span className="text-slate-300">{driver.location}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">HOS Remaining</span>
                  <span className={driver.hoursLeft < 3 ? "text-red-400" : "text-slate-300"}>{driver.hoursLeft}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">CDL Exp.</span>
                  <span className={cdlAlert ? "text-red-400" : "text-slate-400"}>{driver.cdl} {cdlAlert ? "⚠" : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Med. Card Exp.</span>
                  <span className={medAlert ? "text-red-400" : "text-slate-400"}>{driver.med} {medAlert ? "⚠" : ""}</span>
                </div>
              </div>

              {driver.status === "Waiting" && (
                <div className="bg-red-900/30 border border-red-700/50 rounded-sm p-2 font-mono text-xs text-red-300">
                  ⏱ Detention timer active — 3h 30m elapsed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── COMPLIANCE ───────────────────────────────────────────────────────────────
function Compliance() {
  const now = new Date("2025-05-09");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Compliance Center</h1>
        <p className="text-slate-500 font-mono text-xs mt-0.5">Expiration tracking — {COMPLIANCE.length} items monitored</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Critical (Action Required)" value="2" color="red" />
        <StatCard label="Warning (30–90 Days)" value="2" color="amber" />
        <StatCard label="Compliant" value="2" color="green" />
      </div>

      {/* Financial impact */}
      <div className="bg-red-900/20 border border-red-700/50 rounded-sm p-5 space-y-2">
        <div className="text-xs font-mono uppercase tracking-widest text-red-400 border-b border-red-800 pb-2">⚠ Financial Risk</div>
        <div className="grid grid-cols-3 gap-4 font-mono">
          <div>
            <div className="text-xs text-slate-500">Revenue at Risk</div>
            <div className="text-xl text-red-400 font-bold">$21,000</div>
            <div className="text-xs text-slate-500">Jorge Reyes OOS risk</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Est. Downtime Cost</div>
            <div className="text-xl text-red-400 font-bold">$3,200</div>
            <div className="text-xs text-slate-500">Per day if OOS</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Compliance Score</div>
            <div className="text-xl text-amber-400 font-bold">67 / 100</div>
            <div className="text-xs text-slate-500">2 items need action</div>
          </div>
        </div>
      </div>

      {/* Compliance table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Tracked Items</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Item</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Days Remaining</th>
              <th className="text-left p-3">Risk</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {COMPLIANCE.map((item, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="p-3 text-slate-200">{item.item}</td>
                <td className="p-3"><Badge color="slate">{item.type}</Badge></td>
                <td className="p-3 text-slate-400">{item.expires}</td>
                <td className="p-3">
                  <span className={item.severity === "red" ? "text-red-400" : item.severity === "yellow" ? "text-amber-400" : "text-emerald-400"}>
                    {item.daysLeft < 0 ? `EXPIRED (${Math.abs(item.daysLeft)}d ago)` : `${item.daysLeft} days`}
                  </span>
                </td>
                <td className="p-3"><Badge color={item.severity}>{item.severity === "red" ? "CRITICAL" : item.severity === "yellow" ? "WARNING" : "OK"}</Badge></td>
                <td className="p-3">
                  <button className="text-xs text-amber-400 hover:text-amber-300 font-mono underline">
                    {item.severity !== "green" ? "Set Reminder" : "Renew →"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────
function Documents() {
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState([
    { name: "RateCon_LD4821.pdf", type: "Rate Con", load: "LD-4821", date: "May 8, 2025" },
    { name: "BOL_LD4822.pdf", type: "BOL", load: "LD-4822", date: "May 7, 2025" },
    { name: "POD_LD4820.pdf", type: "POD", load: "LD-4820", date: "May 6, 2025" },
    { name: "INV2238.pdf", type: "Invoice", load: "LD-4819", date: "May 5, 2025" },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Document Management</h1>
        <p className="text-slate-500 font-mono text-xs mt-0.5">Centralized paperwork — {uploaded.length} documents stored</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); }}
        className={cx(
          "border-2 border-dashed rounded-sm p-10 text-center transition-colors",
          dragging ? "border-amber-400 bg-amber-900/10" : "border-slate-600 hover:border-slate-500"
        )}
      >
        <div className="text-4xl mb-3">📄</div>
        <div className="font-barlow font-bold text-slate-300 text-lg uppercase">Drop Rate Cons, BOLs, PODs here</div>
        <div className="font-mono text-xs text-slate-500 mt-1">PDF, JPG, PNG — Auto-tagged and linked to loads via OCR</div>
        <button className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-mono text-sm font-bold rounded-sm transition-colors">
          BROWSE FILES
        </button>
      </div>

      {/* OCR auto-extract callout */}
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-sm p-4 font-mono text-sm text-blue-300">
        <strong className="text-blue-200">OCR Auto-Extract:</strong> When you upload a Rate Confirmation, the system automatically extracts Load #, Broker, Pickup, Delivery, and Rate — no manual entry required.
      </div>

      {/* Document List */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Recent Documents</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">File Name</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Linked Load</th>
              <th className="text-left p-3">Uploaded</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {uploaded.map((doc, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="p-3 text-slate-200">{doc.name}</td>
                <td className="p-3"><Badge color={doc.type === "POD" ? "red" : doc.type === "Invoice" ? "blue" : "slate"}>{doc.type}</Badge></td>
                <td className="p-3 text-amber-400">{doc.load}</td>
                <td className="p-3 text-slate-400">{doc.date}</td>
                <td className="p-3 space-x-3">
                  <button className="text-xs text-slate-400 hover:text-slate-200 font-mono">Preview</button>
                  <button className="text-xs text-slate-400 hover:text-slate-200 font-mono">Download</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── INVOICING ────────────────────────────────────────────────────────────────
function Invoicing() {
  const statusColor = (s) => ({ Draft: "slate", Sent: "blue", Viewed: "amber", Overdue: "red", Paid: "green" }[s]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Invoicing & Cash Flow</h1>
          <p className="text-slate-500 font-mono text-xs mt-0.5">{INVOICES.length} invoices tracked</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-mono text-sm font-bold rounded-sm transition-colors">
          + GENERATE INVOICE
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Outstanding" value="$8,700" color="red" />
        <StatCard label="Overdue" value="$2,650" sub="INV-2231 — 18 days" color="red" />
        <StatCard label="Est. Factoring Cost" value="$261" sub="3% on outstanding" color="amber" />
        <StatCard label="Paid This Week" value="$3,400" color="green" />
      </div>

      {/* Invoice table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Invoice Register</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Invoice</th>
              <th className="text-left p-3">Load</th>
              <th className="text-left p-3">Broker</th>
              <th className="text-left p-3">Amount</th>
              <th className="text-left p-3">Days Out</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {INVOICES.map((inv, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="p-3 text-amber-400">{inv.id}</td>
                <td className="p-3 text-slate-300">{inv.load}</td>
                <td className="p-3 text-slate-400">{inv.broker}</td>
                <td className="p-3 text-slate-100 font-bold">${inv.amount.toLocaleString()}</td>
                <td className="p-3">
                  <span className={inv.daysOut > 14 ? "text-red-400" : inv.daysOut > 7 ? "text-amber-400" : "text-slate-400"}>
                    {inv.daysOut === 0 ? "Today" : `${inv.daysOut}d`}
                  </span>
                </td>
                <td className="p-3"><Badge color={statusColor(inv.status)}>{inv.status}</Badge></td>
                <td className="p-3">
                  <button className="text-xs text-amber-400 hover:text-amber-300 font-mono underline">
                    {inv.status === "Draft" ? "Send Invoice →" : inv.status === "Overdue" ? "Follow Up →" : "View →"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice aging */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 pb-3 mb-4">Invoice Aging</div>
        <div className="grid grid-cols-4 gap-3">
          {[
            { range: "0–7 days", amount: "$5,950", color: "text-emerald-400", bar: 68 },
            { range: "8–14 days", amount: "$1,950", color: "text-amber-400", bar: 22 },
            { range: "15–30 days", amount: "$800", color: "text-red-400", bar: 9 },
            { range: "30+ days", amount: "$0", color: "text-slate-500", bar: 0 },
          ].map((bucket, i) => (
            <div key={i} className="space-y-2">
              <div className="text-xs font-mono text-slate-500 uppercase">{bucket.range}</div>
              <div className={cx("font-mono font-bold text-xl", bucket.color)}>{bucket.amount}</div>
              <div className="h-1.5 bg-slate-700 rounded-full">
                <div className={cx("h-full rounded-full transition-all", bucket.bar > 50 ? "bg-emerald-500" : bucket.bar > 15 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${bucket.bar}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PROFITABILITY ────────────────────────────────────────────────────────────
function Profitability() {
  const lanes = [
    { lane: "Chicago → Atlanta", loads: 8, avgRate: 4100, avgProfit: 1080, margin: 26, trend: "up" },
    { lane: "Dallas → Phoenix", loads: 5, avgRate: 3820, avgProfit: 940, margin: 24, trend: "flat" },
    { lane: "Memphis → Charlotte", loads: 6, avgRate: 2850, avgProfit: 680, margin: 23, trend: "down" },
    { lane: "KC → Denver", loads: 3, avgRate: 3100, avgProfit: 820, margin: 26, trend: "up" },
    { lane: "Columbus → Pittsburgh", loads: 11, avgRate: 1600, avgProfit: 380, margin: 23, trend: "flat" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-barlow font-bold text-slate-100 uppercase tracking-wide">Profitability</h1>
        <p className="text-slate-500 font-mono text-xs mt-0.5">Per-load and lane analytics</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Avg Load Margin" value="24.8%" color="green" />
        <StatCard label="Est. Weekly Profit" value="$16,240" color="green" />
        <StatCard label="Worst Margin Lane" value="23%" sub="Memphis → Charlotte" color="amber" />
        <StatCard label="Deadhead Cost Est." value="$840" sub="This week" color="red" />
      </div>

      {/* Per-load table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Per-Load P&L</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Load</th>
              <th className="text-left p-3">Rate</th>
              <th className="text-left p-3">Fuel Est.</th>
              <th className="text-left p-3">Driver Pay</th>
              <th className="text-left p-3">Deadhead</th>
              <th className="text-left p-3">Net Profit</th>
              <th className="text-left p-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {LOADS.map((load, i) => {
              const fuel = Math.round(load.miles * 0.65);
              const driverPay = Math.round(load.rate * 0.28);
              const deadhead = Math.round(load.miles * 0.08);
              return (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="p-3 text-amber-400">{load.id}</td>
                  <td className="p-3 text-slate-200">${load.rate.toLocaleString()}</td>
                  <td className="p-3 text-red-400">-${fuel}</td>
                  <td className="p-3 text-red-400">-${driverPay}</td>
                  <td className="p-3 text-red-400">-${deadhead}</td>
                  <td className="p-3 text-emerald-400 font-bold">${load.profit.toLocaleString()}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${load.margin * 2}%` }} />
                      </div>
                      <span className={load.margin >= 25 ? "text-emerald-400" : "text-amber-400"}>{load.margin}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lane analytics */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-sm">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-500 border-b border-slate-700 p-4">Lane Performance</div>
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-700">
              <th className="text-left p-3">Lane</th>
              <th className="text-left p-3">Loads</th>
              <th className="text-left p-3">Avg Rate</th>
              <th className="text-left p-3">Avg Profit</th>
              <th className="text-left p-3">Margin</th>
              <th className="text-left p-3">Trend</th>
            </tr>
          </thead>
          <tbody>
            {lanes.map((lane, i) => (
              <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="p-3 text-slate-200">{lane.lane}</td>
                <td className="p-3 text-slate-400">{lane.loads}</td>
                <td className="p-3 text-slate-300">${lane.avgRate.toLocaleString()}</td>
                <td className="p-3 text-emerald-400">${lane.avgProfit.toLocaleString()}</td>
                <td className="p-3 text-amber-400">{lane.margin}%</td>
                <td className="p-3">
                  <span className={lane.trend === "up" ? "text-emerald-400" : lane.trend === "down" ? "text-red-400" : "text-slate-400"}>
                    {lane.trend === "up" ? "↑ Up" : lane.trend === "down" ? "↓ Down" : "→ Flat"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PLACEHOLDER VIEWS ────────────────────────────────────────────────────────
function PlaceholderView({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 space-y-3">
      <div className="text-4xl">🔧</div>
      <h2 className="font-barlow font-bold text-slate-300 text-xl uppercase">{title}</h2>
      <p className="font-mono text-sm text-slate-500">{description}</p>
      <Badge color="amber">Coming in Full Build</Badge>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function TruckingOps() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [notifOpen, setNotifOpen] = useState(false);

  const renderView = () => {
    switch (activeNav) {
      case "dashboard": return <Dashboard />;
      case "loads": return <Loads />;
      case "drivers": return <DriversAndTrucks />;
      case "compliance": return <Compliance />;
      case "documents": return <Documents />;
      case "invoicing": return <Invoicing />;
      case "profitability": return <Profitability />;
      case "crm": return <PlaceholderView title="CRM / Contacts" description="Broker tracking, payment speed, load history" />;
      case "settings": return <PlaceholderView title="Settings" description="Branding, users, permissions, integrations" />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <style>{`
        ${FONT_LINK}
        * { box-sizing: border-box; }
        body { margin: 0; background: #0d1117; }
        .font-barlow { font-family: 'Barlow Condensed', sans-serif; }
        .font-mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1e2530; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
      `}</style>

      <div className="flex h-screen bg-slate-900 overflow-hidden" style={{ fontFamily: "'DM Mono', monospace" }}>

        {/* ── SIDEBAR ── */}
        <aside className="w-56 bg-slate-950 border-r border-slate-800 flex flex-col flex-shrink-0">
          {/* Logo */}
          <div className="p-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-sm flex items-center justify-center">
                <span className="text-slate-900 font-bold text-xs">TP</span>
              </div>
              <div>
                <div className="font-barlow font-bold text-slate-100 text-sm uppercase tracking-wide">TruckPilot</div>
                <div className="font-mono text-xs text-slate-600">Operations Platform</div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={cx(
                  "w-full text-left px-3 py-2.5 rounded-sm font-mono text-xs transition-all flex items-center gap-2.5",
                  activeNav === item.id
                    ? "bg-amber-500/15 text-amber-400 border-l-2 border-amber-500"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-l-2 border-transparent"
                )}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="uppercase tracking-wide">{item.label}</span>
                {item.id === "compliance" && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">2</span>
                )}
              </button>
            ))}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-300">JD</div>
              <div>
                <div className="font-mono text-xs text-slate-300">John Daniels</div>
                <div className="font-mono text-xs text-slate-600">Owner</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Topbar */}
          <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search loads, drivers, invoices..."
                className="bg-slate-800 border border-slate-700 rounded-sm px-3 py-1.5 text-xs font-mono text-slate-300 placeholder-slate-600 w-64 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div className="flex items-center gap-4">
              {/* Active alert strip */}
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/50 rounded-sm px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="font-mono text-xs text-red-300">2 compliance alerts</span>
              </div>
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="text-lg">🔔</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-xs text-slate-900 font-bold flex items-center justify-center">4</span>
              </button>
              <div className="w-px h-5 bg-slate-700" />
              <span className="font-mono text-xs text-slate-500">v1.0 DEMO</span>
            </div>
          </header>

          {/* Notification dropdown */}
          {notifOpen && (
            <div className="absolute right-6 top-14 z-50 w-72 bg-slate-900 border border-slate-700 rounded-sm shadow-xl">
              <div className="p-3 border-b border-slate-700 font-mono text-xs uppercase text-slate-500 tracking-widest">Notifications</div>
              {[
                { icon: "⚠", text: "CDL expired — Jorge Reyes", color: "text-red-400" },
                { icon: "⏱", text: "Detention accumulating — LD-4822", color: "text-amber-400" },
                { icon: "📄", text: "POD needed — LD-4822", color: "text-amber-400" },
                { icon: "💵", text: "Invoice overdue — INV-2231 (18d)", color: "text-red-400" },
              ].map((n, i) => (
                <div key={i} className="px-4 py-3 border-b border-slate-800 flex items-start gap-2 hover:bg-slate-800/50 cursor-pointer">
                  <span className={n.color}>{n.icon}</span>
                  <span className="font-mono text-xs text-slate-300">{n.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {renderView()}
          </main>
        </div>
      </div>
    </>
  );
}
