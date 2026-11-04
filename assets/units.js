const $ = (id) => document.getElementById(id);
// Each unit is its size in the category's base unit. Strings are units with their own formulas (see SPECIAL).
const U = {
  Length: { Nanometers: 1e-9, Micrometers: 1e-6, Millimeters: 0.001, Centimeters: 0.01, Meters: 1, Kilometers: 1000, Inches: 0.0254, Feet: 0.3048, Yards: 0.9144, Miles: 1609.344, "Nautical miles": 1852, "Light years": 9460730472580800 },
  Weight: { Micrograms: 1e-9, Milligrams: 1e-6, Grams: 0.001, Kilograms: 1, "Metric tons": 1000, Ounces: 0.028349523125, Pounds: 0.45359237, Stone: 6.35029318, "US tons": 907.18474, "Imperial tons": 1016.0469088, Carats: 0.0002, "Troy ounces": 0.0311034768 },
  Temperature: { Celsius: "C", Fahrenheit: "F", Kelvin: "K", Rankine: "R", "Réaumur": "Re" },
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
  "Volume - dry": { Liters: 1, "Cubic meters": 1000, "US bushels": 35.23907016688, "US pecks": 8.80976754172, "US dry quarts": 1.101220942715, "US dry pints": 0.5506104713575, "UK bushels": 36.36872, "UK pecks": 9.09218, Barrels: 115.627123584 },
  "Volume - lumber": { "Board feet": 1, "Cubic feet": 12, "Cubic meters": 423.776000657, "Cubic inches": 1 / 144, "Cord": 1536, "Thousand board feet": 1000 },
  "Angular velocity": { "Radians per second": 1, "Radians per minute": 1 / 60, "Degrees per second": Math.PI / 180, "Degrees per minute": Math.PI / 10800, "Revolutions per second": 2 * Math.PI, RPM: Math.PI / 30, "Revolutions per hour": Math.PI / 1800 },
  Acceleration: { "Meters per second²": 1, "Centimeters per second² (gal)": 0.01, "Feet per second²": 0.3048, "Inches per second²": 0.0254, "Standard gravity (g)": 9.80665, "Kilometers per hour per second": 1 / 3.6, "Miles per hour per second": 0.44704 },
  "Angular acceleration": { "Radians per second²": 1, "Radians per minute²": 1 / 3600, "Degrees per second²": Math.PI / 180, "Revolutions per second²": 2 * Math.PI, "Revolutions per minute²": (2 * Math.PI) / 3600, "RPM per second": Math.PI / 30 },
  Density: { "Kilograms per cubic meter": 1, "Grams per cubic centimeter": 1000, "Grams per liter": 1, "Kilograms per liter": 1000, "Pounds per cubic foot": 16.01846337, "Pounds per cubic inch": 27679.9047, "Pounds per US gallon": 119.8264273, "Ounces per cubic inch": 1729.994044, "Slugs per cubic foot": 515.3788184 },
  "Specific volume": { "Cubic meters per kilogram": 1, "Liters per kilogram": 0.001, "Cubic centimeters per gram": 0.001, "Cubic feet per pound": 0.06242796, "US gallons per pound": 0.008345404, "Cubic inches per pound": 3.6127292e-5 },
  "Moment of inertia": { "Kilogram meter²": 1, "Kilogram centimeter²": 1e-4, "Gram centimeter²": 1e-7, "Pound foot²": 0.04214011, "Pound inch²": 0.0002926397, "Slug foot²": 1.355817962 },
  Torque: { "Newton meters": 1, "Kilonewton meters": 1000, "Newton centimeters": 0.01, "Kilogram-force meters": 9.80665, "Kilogram-force centimeters": 0.0980665, "Pound-force feet": 1.3558179483, "Pound-force inches": 0.1129848290, "Ounce-force inches": 0.00706155181, "Dyne centimeters": 1e-7 },
  "Fuel efficiency - mass": { "Joules per kilogram": 1, "Kilojoules per kilogram": 1000, "Calories per gram": 4184, "Kilocalories per kilogram": 4184, "BTU per pound": 2326 },
  "Fuel efficiency - volume": { "Joules per cubic meter": 1, "Joules per liter": 1000, "Megajoules per cubic meter": 1e6, "Kilocalories per cubic meter": 4184, "BTU per cubic foot": 37258.9458, "BTU per US gallon": 278716.4, "Therms per cubic foot": 3725894580, "Calories per cubic centimeter": 4184000 },
  "Temperature interval": { Kelvin: 1, "Degrees Celsius": 1, "Degrees Fahrenheit": 5 / 9, "Degrees Rankine": 5 / 9, "Degrees Réaumur": 1.25 },
  "Thermal expansion": { "Per kelvin": 1, "Per degree Celsius": 1, "Per degree Fahrenheit": 1.8, "Per degree Rankine": 1.8, "Per degree Réaumur": 0.8 },
  "Thermal resistance": { "Kelvin per watt": 1, "Degrees Fahrenheit hour per BTU": 1.895634 },
  "Thermal conductivity": { "Watts per meter kelvin": 1, "Watts per centimeter kelvin": 100, "Kilowatts per meter kelvin": 1000, "Calories per second centimeter °C": 418.4, "Kilocalories per hour meter °C": 1.163, "BTU per hour foot °F": 1.730734666, "BTU inch per hour square foot °F": 0.144227889 },
  "Specific heat capacity": { "Joules per kilogram kelvin": 1, "Kilojoules per kilogram kelvin": 1000, "Calories per gram °C": 4186.8, "Kilocalories per kilogram °C": 4186.8, "BTU per pound °F": 4186.8 },
  "Heat density": { "Joules per square meter": 1, "Kilojoules per square meter": 1000, "Calories per square centimeter (langley)": 41840, "BTU per square foot": 11356.526682, "Kilocalories per square meter": 4184 },
  "Heat flux density": { "Watts per square meter": 1, "Kilowatts per square meter": 1000, "Watts per square centimeter": 1e4, "Watts per square inch": 1550.0031, "BTU per hour square foot": 3.154590745, "Kilocalories per hour square meter": 1.163, "Calories per second square centimeter": 41840 },
  "Heat transfer coefficient": { "Watts per square meter kelvin": 1, "Watts per square centimeter °C": 1e4, "Kilocalories per hour square meter °C": 1.163, "BTU per hour square foot °F": 5.678263341, "Calories per second square centimeter °C": 41868 },
  Flow: { "Cubic meters per second": 1, "Cubic meters per hour": 1 / 3600, "Liters per second": 0.001, "Liters per minute": 1 / 60000, "Liters per hour": 1 / 3.6e6, "US gallons per minute": 6.30901964e-5, "US gallons per hour": 1.05150327e-6, "UK gallons per minute": 7.57681667e-5, "Cubic feet per second": 0.028316846592, "Cubic feet per minute": 0.00047194744, "Barrels (oil) per day": 1.84013e-6 },
  "Flow - mass": { "Kilograms per second": 1, "Grams per second": 0.001, "Kilograms per minute": 1 / 60, "Kilograms per hour": 1 / 3600, "Tonnes per hour": 1 / 3.6, "Tonnes per day": 1 / 86.4, "Pounds per second": 0.45359237, "Pounds per minute": 0.0075598728, "Pounds per hour": 0.000125997881 },
  "Flow - molar": { "Moles per second": 1, "Kilomoles per second": 1000, "Millimoles per second": 0.001, "Moles per minute": 1 / 60, "Moles per hour": 1 / 3600, "Kilomoles per hour": 1 / 3.6 },
  "Mass flux density": { "Kilograms per second square meter": 1, "Grams per second square centimeter": 10, "Kilograms per hour square meter": 1 / 3600, "Pounds per hour square foot": 0.00135623, "Pounds per second square foot": 4.882427636 },
  "Concentration - molar": { "Moles per liter (molar)": 1, "Millimoles per liter": 0.001, "Micromoles per liter": 1e-6, "Nanomoles per liter": 1e-9, "Moles per cubic meter": 0.001, "Kilomoles per cubic meter": 1 },
  "Concentration - solution": { "Kilograms per liter": 1, "Grams per liter": 0.001, "Milligrams per liter": 1e-6, "Grams per milliliter": 1, "Parts per million (water)": 1e-6, "Pounds per US gallon": 0.119826427, "Grains per US gallon": 1.71181e-5 },
  "Viscosity - dynamic": { "Pascal seconds": 1, "Millipascal seconds": 0.001, Poise: 0.1, Centipoise: 0.001, "Newton seconds per square meter": 1, "Pound-force seconds per square foot": 47.88025898, "Pounds per foot second": 1.488163944 },
  "Viscosity - kinematic": { "Square meters per second": 1, "Square millimeters per second": 1e-6, Stokes: 1e-4, Centistokes: 1e-6, "Square feet per second": 0.09290304, "Square inches per second": 0.00064516 },
  "Surface tension": { "Newtons per meter": 1, "Millinewtons per meter": 0.001, "Dynes per centimeter": 0.001, "Pound-force per inch": 175.1268352, "Gram-force per centimeter": 0.980665 },
  Permeability: { "Darcy": 1, Millidarcy: 0.001, "Square meters": 1.01325e12, "Square centimeters": 1.01325e8, "Square feet": 9.41348e10 },
  Luminance: { "Candela per square meter (nit)": 1, "Candela per square centimeter": 1e4, "Candela per square foot": 10.7639104, "Candela per square inch": 1550.0031, Footlambert: 3.4262591, Lambert: 3183.0988618, Stilb: 1e4 },
  "Luminous intensity": { Candela: 1, "Candle (international)": 1.01936799, Hefnerkerze: 0.903, "Lumens per steradian": 1 },
  Illumination: { Lux: 1, "Lumens per square meter": 1, "Foot-candles": 10.7639104, Phot: 1e4, Nox: 0.001, "Lumens per square centimeter": 1e4 },
  "Image resolution": { "Dots per inch": 1, "Pixels per inch": 1, "Dots per centimeter": 2.54, "Dots per meter": 0.0254, "Dots per millimeter": 25.4 },
  "Frequency and wavelength": { Hertz: "Hz", Kilohertz: "kHz", Megahertz: "MHz", Gigahertz: "GHz", "Wavelength in meters": "wm", "Wavelength in centimeters": "wcm", "Wavelength in millimeters": "wmm", "Wavelength in micrometers": "wum", "Wavelength in nanometers": "wnm" },
  "Linear charge density": { "Coulombs per meter": 1, "Coulombs per centimeter": 100, "Coulombs per inch": 39.3700787, "Microcoulombs per meter": 1e-6, "Abcoulombs per meter": 10 },
  "Surface charge density": { "Coulombs per square meter": 1, "Coulombs per square centimeter": 1e4, "Coulombs per square inch": 1550.0031, "Microcoulombs per square meter": 1e-6, "Abcoulombs per square meter": 10 },
  "Volume charge density": { "Coulombs per cubic meter": 1, "Coulombs per cubic centimeter": 1e6, "Coulombs per cubic inch": 61023.744, "Microcoulombs per cubic meter": 1e-6, "Abcoulombs per cubic meter": 10 },
  "Linear current density": { "Amps per meter": 1, "Amps per centimeter": 100, "Amps per inch": 39.3700787, "Abamps per meter": 10, "Oersteds": 79.5774715 },
  "Surface current density": { "Amps per square meter": 1, "Amps per square centimeter": 1e4, "Amps per square inch": 1550.0031, "Amps per square mil": 1.5500031e9, "Amps per circular mil": 1.973525241e9 },
  "Electric field strength": { "Volts per meter": 1, "Kilovolts per meter": 1000, "Kilovolts per centimeter": 1e5, "Volts per centimeter": 100, "Volts per millimeter": 1000, "Volts per inch": 39.3700787, "Volts per mil": 39370.0787, "Statvolts per centimeter": 29979.2458 },
  "Electric resistance": { Ohms: 1, Milliohms: 0.001, Microohms: 1e-6, Kilohms: 1000, Megohms: 1e6, Gigohms: 1e9, Abohms: 1e-9, Statohms: 8.987551787e11 },
  "Electric resistivity": { "Ohm meters": 1, "Ohm centimeters": 0.01, "Ohm inches": 0.0254, "Microohm centimeters": 1e-8, "Ohm circular mils per foot": 1.662426113e-9, "Ohm square millimeters per meter": 1e-6 },
  "Electric conductance": { Siemens: 1, Millisiemens: 0.001, Microsiemens: 1e-6, Kilosiemens: 1000, Mhos: 1, "Amps per volt": 1, Abmhos: 1e9 },
  "Electric conductivity": { "Siemens per meter": 1, "Millisiemens per centimeter": 0.1, "Microsiemens per centimeter": 1e-4, "Siemens per centimeter": 100, "Mhos per meter": 1, "Abmhos per meter": 1e9 },
  Capacitance: { Farads: 1, Millifarads: 0.001, Microfarads: 1e-6, Nanofarads: 1e-9, Picofarads: 1e-12, Abfarads: 1e9, Statfarads: 1.112650056e-12 },
  Inductance: { Henries: 1, Millihenries: 0.001, Microhenries: 1e-6, Nanohenries: 1e-9, Kilohenries: 1000, Abhenries: 1e-9, Stathenries: 8.987551787e11 },
  "Magnetomotive force": { "Ampere-turns": 1, "Kiloampere-turns": 1000, "Milliampere-turns": 0.001, Gilberts: 0.795774715 },
  "Magnetic field strength": { "Amps per meter": 1, "Amps per centimeter": 100, "Ampere-turns per inch": 39.3700787, Oersteds: 79.5774715 },
  "Magnetic flux": { Webers: 1, Milliwebers: 0.001, Microwebers: 1e-6, Maxwells: 1e-8, "Volt seconds": 1, "Unit poles": 1.256637e-7, Kilolines: 1e-5 },
  "Magnetic flux density": { Teslas: 1, Milliteslas: 0.001, Microteslas: 1e-6, Nanoteslas: 1e-9, Gauss: 1e-4, Milligauss: 1e-7, "Webers per square meter": 1, "Maxwells per square centimeter": 1e-4, Gammas: 1e-9 },
  "Radiation dose equivalent": { Sieverts: 1, Millisieverts: 0.001, Microsieverts: 1e-6, Rem: 0.01, Millirem: 1e-5 },
  "Radiation activity": { Becquerels: 1, Kilobecquerels: 1000, Megabecquerels: 1e6, Gigabecquerels: 1e9, Curies: 3.7e10, Millicuries: 3.7e7, Microcuries: 3.7e4, Rutherfords: 1e6, "Disintegrations per minute": 1 / 60 },
  "Radiation exposure": { "Coulombs per kilogram": 1, "Millicoulombs per kilogram": 0.001, Roentgens: 2.58e-4, Milliroentgens: 2.58e-7, Microroentgens: 2.58e-10 },
  "Radiation absorbed dose": { Grays: 1, Milligrays: 0.001, Micrograys: 1e-6, Rads: 0.01, Millirads: 1e-5, "Joules per kilogram": 1, "Ergs per gram": 1e-4 },
  Prefixes: { Yotta: 1e24, Zetta: 1e21, Exa: 1e18, Peta: 1e15, Tera: 1e12, Giga: 1e9, Mega: 1e6, Kilo: 1e3, Hecto: 100, Deka: 10, "None (1)": 1, Deci: 0.1, Centi: 0.01, Milli: 1e-3, Micro: 1e-6, Nano: 1e-9, Pico: 1e-12, Femto: 1e-15, Atto: 1e-18, Zepto: 1e-21, Yocto: 1e-24 },
  Sound: { "Bels": 10, "Decibels": 1, Nepers: 8.685889638 },
  Typography: { Points: 1, Picas: 12, Pixels: 0.75, Inches: 72, Centimeters: 72 / 2.54, Millimeters: 72 / 25.4, "Twips": 0.05, Em: 12, "Didot points": 1.0700086, Ciceros: 12.840103 },
  "Moment of force": { "Newton meters": 1, "Kilonewton meters": 1000, "Kilogram-force meters": 9.80665, "Pound-force feet": 1.3558179483, "Pound-force inches": 0.1129848290, "Dyne centimeters": 1e-7, "Gram-force centimeters": 9.80665e-5 },
  Concentration: { Fraction: 1, Percent: 0.01, "Parts per million (ppm)": 1e-6, "Parts per billion (ppb)": 1e-9, "Parts per trillion (ppt)": 1e-12, "Milligrams per liter (water)": 1e-6 },
};
// Units that aren't a simple multiple: convert to and from the category's base unit
const SPECIAL = {
  C: [(v) => v + 273.15, (k) => k - 273.15], F: [(v) => (v - 32) * 5 / 9 + 273.15, (k) => (k - 273.15) * 9 / 5 + 32], K: [(v) => v, (k) => k], R: [(v) => v * 5 / 9, (k) => k * 9 / 5],
  dBm: [(v) => Math.pow(10, v / 10) / 1000, (w) => 10 * Math.log10(w * 1000)],
  L100: [(v) => 100 / v, (k) => 100 / k],
  Re: [(v) => v * 1.25 + 273.15, (k) => (k - 273.15) * 0.8],
  Hz: [(v) => v, (h) => h], kHz: [(v) => v * 1e3, (h) => h / 1e3], MHz: [(v) => v * 1e6, (h) => h / 1e6], GHz: [(v) => v * 1e9, (h) => h / 1e9],
  // Electromagnetic waves: frequency = speed of light / wavelength
  wm: [(v) => 299792458 / v, (h) => 299792458 / h], wcm: [(v) => 29979245800 / v, (h) => 29979245800 / h], wmm: [(v) => 299792458e3 / v, (h) => 299792458e3 / h], wum: [(v) => 299792458e6 / v, (h) => 299792458e6 / h], wnm: [(v) => 299792458e9 / v, (h) => 299792458e9 / h],
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
  $("from").value = first && units[want.from] !== undefined ? want.from : DEF[$("cat").value] || Object.keys(units)[0];
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
