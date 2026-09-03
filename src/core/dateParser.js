const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
require('dayjs/locale/es');

dayjs.extend(customParseFormat);

function parseDate(value, format, locale = 'en') {
  // dayjs matches MMM month names case-sensitively per locale: 'es' months are
  // lowercase ("ene"), 'en' months are capitalized ("Jun"). Only lowercase for
  // non-en locales so capitalized English month names still parse.
  const normalized = typeof value === 'string' && format && format.includes('MMM') && locale !== 'en'
    ? value.toLowerCase()
    : value;
  const parsed = dayjs(normalized, format, locale);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date "${value}" for format "${format}" (locale ${locale})`);
  }
  return parsed.toISOString();
}

module.exports = { parseDate };
