const $ = (id) => document.getElementById(id);
const U = {
  Length: { Millimeters: 0.001, Centimeters: 0.01, Meters: 1, Kilometers: 1000, Inches: 0.0254, Feet: 0.3048, Yards: 0.9144, Miles: 1609.344, "Nautical miles": 1852 },
  Weight: { Milligrams: 1e-6, Grams: 0.001, Kilograms: 1, "Metric tons": 1000, Ounces: 0.028349523125, Pounds: 0.45359237, Stone: 6.35029318, "US tons": 907.18474 },
  Temperature: { Celsius: "C", Fahrenheit: "F", Kelvin: "K" },
  Volume: { Milliliters: 0.001, Liters: 1, "Cubic meters": 1000, Teaspoons: 0.00492892159375, Tablespoons: 0.0147867647813, "Fluid ounces": 0.0295735295625, Cups: 0.2365882365, Pints: 0.473176473, Quarts: 0.946352946, Gallons: 3.785411784, "Imperial gallons": 4.54609 },
  Area: { "Square centimeters": 1e-4, "Square meters": 1, Hectares: 1e4, "Square kilometers": 1e6, "Square inches": 0.00064516, "Square feet": 0.09290304, "Square yards": 0.83612736, Acres: 4046.8564224, "Square miles": 2589988.110336 },
  Speed: { "Meters per second": 1, "Kilometers per hour": 1 / 3.6, "Miles per hour": 0.44704, Knots: 1852 / 3600, "Feet per second": 0.3048 },
};
const toK = { C: (v) => v + 273.15, F: (v) => (v - 32) * 5 / 9 + 273.15, K: (v) => v };
const fromK = { C: (k) => k - 273.15, F: (k) => (k - 273.15) * 9 / 5 + 32, K: (k) => k };
const fmt = (x) => (Math.abs(x) >= 1e15 || (Math.abs(x) < 1e-6 && x !== 0) ? x.toExponential(4) : (+x.toPrecision(6)).toLocaleString(undefined, { maximumFractionDigits: 10 }));
Object.keys(U).forEach((c) => $("cat").add(new Option(c, c)));
function fillUnits() {
  const units = U[$("cat").value]; $("from").textContent = "";
  Object.keys(units).forEach((u) => $("from").add(new Option(u, u)));
  $("from").value = { Length: "Meters", Weight: "Kilograms", Temperature: "Celsius", Volume: "Liters", Area: "Square meters", Speed: "Kilometers per hour" }[$("cat").value];
}
function update() {
  const units = U[$("cat").value], from = $("from").value, v = parseFloat($("val").value);
  const tb = $("table"); tb.textContent = "";
  if (!Number.isFinite(v)) return;
  for (const [name, f] of Object.entries(units)) {
    if (name === from) continue;
    const out = typeof f === "string" ? fromK[f](toK[units[from]](v)) : (v * units[from]) / f;
    const tr = document.createElement("tr");
    const a = document.createElement("td"); a.textContent = fmt(out);
    const b = document.createElement("td"); b.textContent = name; b.style.fontWeight = "400";
    tr.append(a, b); tb.append(tr);
  }
}
$("cat").addEventListener("change", () => { fillUnits(); update(); });
$("from").addEventListener("change", update);
$("val").addEventListener("input", update);
fillUnits(); update();
