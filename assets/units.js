const $ = (id) => document.getElementById(id);
// Each unit is its size in the category's base unit. Strings are units with their own formulas (see SPECIAL).
const U = {
  Length: { Nanometers: 1e-9, Micrometers: 1e-6, Millimeters: 0.001, Centimeters: 0.01, Meters: 1, Kilometers: 1000, Inches: 0.0254, Feet: 0.3048, Yards: 0.9144, Miles: 1609.344, "Nautical miles": 1852, "Light years": 9460730472580800 },
  Weight: { Micrograms: 1e-9, Milligrams: 1e-6, Grams: 0.001, Kilograms: 1, "Metric tons": 1000, Ounces: 0.028349523125, Pounds: 0.45359237, Stone: 6.35029318, "US tons": 907.18474, "Imperial tons": 1016.0469088, Carats: 0.0002, "Troy ounces": 0.0311034768 },
  Temperature: { Celsius: "C", Fahrenheit: "F", Kelvin: "K", Rankine: "R" },
  Volume: { Milliliters: 0.001, Liters: 1, "Cubic meters": 1000, "Cubic centimeters": 0.001, "Cubic inches": 0.016387064, "Cubic feet": 28.316846592, Teaspoons: 0.00492892159375, Tablespoons: 0.0147867647813, "Fluid ounces": 0.0295735295625, Cups: 0.2365882365, Pints: 0.473176473, Quarts: 0.946352946, Gallons: 3.785411784, "Imperial gallons": 4.54609 },
  Area: { "Square millimeters": 1e-6, "Square centimeters": 1e-4, "Square meters": 1, Hectares: 1e4, "Square kilometers": 1e6, "Square inches": 0.00064516, "Square feet": 0.09290304, "Square yards": 0.83612736, Acres: 4046.8564224, "Square miles": 2589988.110336 },
  Speed: { "Meters per second": 1, "Kilometers per hour": 1 / 3.6, "Miles per hour": 0.44704, Knots: 1852 / 3600, "Feet per second": 0.3048, Mach: 340.29, "Speed of light": 299792458 },
  Time: { Nanoseconds: 1e-9, Microseconds: 1e-6, Milliseconds: 0.001, Seconds: 1, Minutes: 60, Hours: 3600, Days: 86400, Weeks: 604800, Months: 2629746, Years: 31556952, Decades: 315569520, Centuries: 3155695200 },
  Power: { Milliwatts: 0.001, Watts: 1, Kilowatts: 1000, Megawatts: 1e6, Gigawatts: 1e9, Horsepower: 745.69987158227, "Brake horsepower": 745.69987158227, "Metric horsepower": 735.49875, "BTU per hour": 0.29307107, "Tons of refrigeration": 3516.8528421, "Joules per second": 1, dBm: "dBm" },
  Energy: { Joules: 1, Kilojoules: 1000, Megajoules: 1e6, Calories: 4.184, Kilocalories: 4184, "Watt hours": 3600, "Kilowatt hours": 3.6e6, BTU: 1055.05585262, Therms: 105505585.262, "Electron volts": 1.602176634e-19, "Kiloelectron volts": 1.602176634e-16, "Megaelectron volts": 1.602176634e-13, "Gigaelectron volts": 1.602176634e-10, "Foot-pounds": 1.3558179483 },
  Voltage: { Microvolts: 1e-6, Millivolts: 0.001, Volts: 1, Kilovolts: 1000, Megavolts: 1e6, Gigavolts: 1e9 },
  Current: { Microamps: 1e-6, Milliamps: 0.001, Amps: 1, Kiloamps: 1000 },
  "Electric charge": { Picocoulombs: 1e-12, Nanocoulombs: 1e-9, Microcoulombs: 1e-6, Millicoulombs: 0.001, Coulombs: 1, "Electron charges": 1.602176634e-19, "Milliamp hours": 3.6, "Amp hours": 3600 },
  Frequency: { Hertz: 1, Kilohertz: 1e3, Megahertz: 1e6, Gigahertz: 1e9, Terahertz: 1e12, "Radians per second": 1 / (2 * Math.PI), RPM: 1 / 60 },
  Pressure: { Pascals: 1, Kilopascals: 1000, Megapascals: 1e6, Bar: 1e5, Millibar: 100, Atmospheres: 101325, PSI: 6894.757293168, "mm of mercury": 133.322387415, "Inches of mercury": 3386.389, Torr: 101325 / 760 },
  Force: { Newtons: 1, Kilonewtons: 1000, Dynes: 1e-5, "Pounds-force": 4.4482216152605, "Kilograms-force": 9.80665 },
  Angle: { Degrees: 1, Radians: 180 / Math.PI, Gradians: 0.9, "Arc minutes": 1 / 60, "Arc seconds": 1 / 3600, Turns: 360 },
  "Data storage": { Bits: 0.125, Bytes: 1, Kilobytes: 1e3, Megabytes: 1e6, Gigabytes: 1e9, Terabytes: 1e12, Petabytes: 1e15, Kibibytes: 1024, Mebibytes: 1048576, Gibibytes: 1073741824, Tebibytes: 1099511627776 },
  "Data rate": { "Bits per second": 1, "Kilobits per second": 1e3, "Megabits per second": 1e6, "Gigabits per second": 1e9, "Bytes per second": 8, "Kilobytes per second": 8e3, "Megabytes per second": 8e6, "Gigabytes per second": 8e9 },
  "Fuel economy": { "Kilometers per liter": 1, "Miles per gallon (US)": 0.425143707, "Miles per gallon (UK)": 0.35400619, "Liters per 100 km": "L100" },
  Concentration: { Fraction: 1, Percent: 0.01, "Parts per million (ppm)": 1e-6, "Parts per billion (ppb)": 1e-9, "Parts per trillion (ppt)": 1e-12, "Milligrams per liter (water)": 1e-6 },
};
// Units that aren't a simple multiple: convert to and from the category's base unit
const SPECIAL = {
  C: [(v) => v + 273.15, (k) => k - 273.15], F: [(v) => (v - 32) * 5 / 9 + 273.15, (k) => (k - 273.15) * 9 / 5 + 32], K: [(v) => v, (k) => k], R: [(v) => v * 5 / 9, (k) => k * 9 / 5],
  dBm: [(v) => Math.pow(10, v / 10) / 1000, (w) => 10 * Math.log10(w * 1000)],
  L100: [(v) => 100 / v, (k) => 100 / k],
};
const DEF = { Length: "Meters", Weight: "Kilograms", Temperature: "Celsius", Volume: "Liters", Area: "Square meters", Speed: "Kilometers per hour", Time: "Seconds", Power: "Watts", Energy: "Joules", Voltage: "Volts", Current: "Amps", "Electric charge": "Coulombs", Frequency: "Hertz", Pressure: "Pascals", Force: "Newtons", Angle: "Degrees", "Data storage": "Megabytes", "Data rate": "Megabits per second", "Fuel economy": "Kilometers per liter", Concentration: "Percent" };
const toBase = (u, v) => (typeof u === "string" ? SPECIAL[u][0](v) : v * u);
const fromBase = (u, b) => (typeof u === "string" ? SPECIAL[u][1](b) : b / u);
const fmt = (x) => (!Number.isFinite(x) ? "–" : Math.abs(x) >= 1e15 || (Math.abs(x) < 1e-6 && x !== 0) ? x.toExponential(6).replace(/\.?0+e/, "e") : (+x.toPrecision(10)).toLocaleString(undefined, { maximumFractionDigits: 10 }));
// Landing pages like /cm-to-inches preset the converter with data-cat/data-from/data-to on #cat; ?cat=&from=&to=&v= works too.
const q = new URLSearchParams(location.search), pre = $("cat").dataset;
const want = { cat: q.get("cat") || pre.cat, from: q.get("from") || pre.from, to: q.get("to") || pre.to };
if (q.get("v")) $("val").value = q.get("v");
Object.keys(U).forEach((c) => $("cat").add(new Option(c, c)));
if (U[want.cat]) $("cat").value = want.cat;
function fillUnits(first) {
  const units = U[$("cat").value];
  for (const id of ["from", "to"]) { if (!$(id)) continue; $(id).textContent = ""; Object.keys(units).forEach((u) => $(id).add(new Option(u, u))); }
  $("from").value = first && units[want.from] !== undefined ? want.from : DEF[$("cat").value];
  if ($("to")) $("to").value = first && units[want.to] !== undefined ? want.to : Object.keys(units).find((u) => u !== $("from").value);
}
function update() {
  const units = U[$("cat").value], from = $("from").value, v = parseFloat($("val").value);
  const tb = $("table"); tb.textContent = "";
  if ($("answer")) $("answer").textContent = "";
  if (!Number.isFinite(v)) return;
  const base = toBase(units[from], v);
  if ($("to") && $("answer")) $("answer").textContent = `${fmt(v)} ${from} = ${fmt(fromBase(units[$("to").value], base))} ${$("to").value}`;
  for (const [name, f] of Object.entries(units)) {
    if (name === from) continue;
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.textContent = fmt(fromBase(f, base));
    const b = document.createElement("td"); b.textContent = name; b.style.fontWeight = "400";
    tr.append(a, b); tb.append(tr);
  }
}
$("cat").addEventListener("change", () => { fillUnits(false); update(); });
["from", "to"].forEach((id) => $(id) && $(id).addEventListener("change", update));
$("val").addEventListener("input", update);
if ($("swap")) $("swap").addEventListener("click", () => { const f = $("from").value; $("from").value = $("to").value; $("to").value = f; update(); });
fillUnits(true); update();
