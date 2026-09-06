/**
 * Map of Autodesk / Revit schema unit identifiers to standard, human-readable abbreviations.
 */
export const UNIT_MAP: Record<string, string> = {
  // Length
  millimeters: 'mm',
  millimeter: 'mm',
  centimeters: 'cm',
  centimeter: 'cm',
  meters: 'm',
  meter: 'm',
  inches: 'in',
  inch: 'in',
  feet: 'ft',
  foot: 'ft',
  feetAndFractionalInches: 'ft-in',
  feetFractionalInches: 'ft-in',
  fractionalInches: 'in',
  fractionalInch: 'in',
  decimalFeet: 'ft',
  decimalInches: 'in',
  decimalInch: 'in',

  // Area
  squareMeters: 'm²',
  squareMeter: 'm²',
  squareMillimeters: 'mm²',
  squareCentimeters: 'cm²',
  squareFeet: 'sq ft',
  squareFoot: 'sq ft',
  squareInches: 'sq in',
  squareInch: 'sq in',
  acres: 'acres',
  hectares: 'ha',

  // Volume
  cubicMeters: 'm³',
  cubicMeter: 'm³',
  cubicCentimeters: 'cm³',
  cubicMillimeters: 'mm³',
  cubicFeet: 'cu ft',
  cubicFoot: 'cu ft',
  cubicInches: 'cu in',
  cubicYard: 'cu yd',
  cubicYards: 'cu yd',
  liters: 'L',
  liter: 'L',
  gallons: 'gal',
  gallon: 'gal',

  // Temperature & Angles
  celsius: '°C',
  fahrenheit: '°F',
  kelvin: 'K',
  degrees: '°',
  degree: '°',
  radians: 'rad',
  gradian: 'grad',

  // Electrical
  amperes: 'A',
  ampere: 'A',
  volts: 'V',
  volt: 'V',
  watts: 'W',
  watt: 'W',
  kilowatts: 'kW',
  kilowatt: 'kW',
  megawatts: 'MW',
  voltAmperes: 'VA',
  kiloVoltAmperes: 'kVA',
  hertz: 'Hz',

  // Thermal & HVAC
  hourSquareFootDegreesFahrenheitPerBritishThermalUnit: 'hr·ft²·°F/BTU',
  hourSquareFootDegreeFahrenheitPerBritishThermalUnit: 'hr·ft²·°F/BTU',
  britishThermalUnitsPerHourSquareFootDegreeFahrenheit: 'BTU/(h·ft²·°F)',
  britishThermalUnitsPerHourSquareFootDegreesFahrenheit: 'BTU/(h·ft²·°F)',
  britishThermalUnitPerHourSquareFootDegreeFahrenheit: 'BTU/(h·ft²·°F)',
  britishThermalUnitsPerSquareFootDegreeFahrenheit: 'BTU/(ft²·°F)',
  britishThermalUnitsPerSquareFootDegreesFahrenheit: 'BTU/(ft²·°F)',
  britishThermalUnitPerSquareFootDegreeFahrenheit: 'BTU/(ft²·°F)',
  britishThermalUnitsPerHour: 'BTU/h',
  britishThermalUnitPerHour: 'BTU/h',
  britishThermalUnit: 'BTU',
  britishThermalUnits: 'BTU',
  wattsPerSquareMeterKelvin: 'W/(m²·K)',
  wattPerSquareMeterKelvin: 'W/(m²·K)',
  joulesPerKelvin: 'J/K',
  joulesPerKilogramKelvin: 'J/(kg·K)',

  // Pressure & Force
  pascal: 'Pa',
  pascals: 'Pa',
  kilopascal: 'kPa',
  kilopascals: 'kPa',
  megapascal: 'MPa',
  bar: 'bar',
  poundsPerSquareInch: 'psi',
  newtons: 'N',
  newton: 'N',
  kilonewtons: 'kN',
  kilonewton: 'kN',
  poundsForce: 'lbf',

  // Mass & Weight
  pounds: 'lbs',
  pound: 'lbs',
  kilograms: 'kg',
  kilogram: 'kg',
  grams: 'g',
  gram: 'g',
  metricTonnes: 't',

  // Time & Rates
  seconds: 's',
  second: 's',
  minutes: 'min',
  minute: 'min',
  hours: 'hr',
  hour: 'hr',
  cubicFeetPerMinute: 'CFM',
  litersPerSecond: 'L/s',
  gallonsPerMinute: 'GPM',

  // Misc
  percentage: '%',
  percent: '%',
  ratio: '',
  currency: '$',
};

/**
 * Parses and formats an Autodesk/APS schema unit identifier into a human-readable abbreviation.
 */
export function formatPropUnit(unitStr?: string): string {
  if (!unitStr) return '';
  let clean = String(unitStr).trim();
  if (clean.includes(':')) {
    clean = clean.split(':').pop() || clean;
  }
  // Remove version suffix like -1.0.1 or -2.0.0
  clean = clean.replace(/-\d+(\.\d+)*$/, '');

  if (UNIT_MAP[clean]) return UNIT_MAP[clean];

  // If it's a compound unit in camelCase (e.g. "kiloWattsPerSquareMeter")
  const words = clean.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words;
}

/**
 * Cleans and formats raw property values from Autodesk Viewer / Model Derivative API.
 */
export function formatPropValue(prop: any): string {
  if (prop === undefined || prop === null) return '—';

  // If passed a full property object or a raw value
  let val = typeof prop === 'object' && prop !== null && 'displayValue' in prop ? prop.displayValue : prop;

  // Fallback if displayValue is just a unit schema URI while attributeValue/value has the actual number
  if (
    typeof prop === 'object' &&
    prop !== null &&
    typeof val === 'string' &&
    (val.startsWith('autodesk.unit.') || val.startsWith('autodesk.spec.'))
  ) {
    if (prop.attributeValue !== undefined && prop.attributeValue !== null && !String(prop.attributeValue).startsWith('autodesk.')) {
      val = prop.attributeValue;
    } else if (prop.value !== undefined && prop.value !== null && !String(prop.value).startsWith('autodesk.')) {
      val = prop.value;
    }
  }

  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    return Number.isInteger(val) ? String(val) : Number(val.toFixed(3)).toString();
  }

  const str = String(val).trim();
  if (!str) return '—';

  // If the value itself is an Autodesk schema unit URI
  if (str.startsWith('autodesk.unit.') || str.startsWith('autodesk.spec.')) {
    return formatPropUnit(str);
  }

  return str;
}
