const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
require('dayjs/locale/es');

dayjs.extend(customParseFormat);

// dayjs matches MMM month names case-sensitively per locale: 'es' months are
// lowercase ("ene"), 'en' months are capitalized ("Jun"). Only lowercase for
// non-en locales so capitalized English month names still parse.
function normalizeMonth(value, format, locale) {
  return typeof value === 'string' && format && format.includes('MMM') && locale !== 'en'
    ? value.toLowerCase()
    : value;
}

function parseDate(value, format, locale = 'en') {
  const parsed = dayjs(normalizeMonth(value, format, locale), format, locale);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date "${value}" for format "${format}" (locale ${locale})`);
  }
  return parsed.toISOString();
}

// parseDate is lenient and reads '2025/03/15' as DD/MM/YYYY without complaint.
// This one tells apart bank formats that look alike.
function matchesDateFormat(value, format, locale = 'en') {
  if (typeof value !== 'string') return false;
  return dayjs(normalizeMonth(value.trim(), format, locale), format, locale, true).isValid();
}

module.exports = { parseDate, matchesDateFormat };
