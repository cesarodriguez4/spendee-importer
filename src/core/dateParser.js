const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
require('dayjs/locale/es');

dayjs.extend(customParseFormat);

function parseDate(value, format, locale = 'en') {
  const normalized = typeof value === 'string' && format && format.includes('MMM')
    ? value.toLowerCase()
    : value;
  const parsed = dayjs(normalized, format, locale);
  if (!parsed.isValid()) {
    throw new Error(`Invalid date "${value}" for format "${format}" (locale ${locale})`);
  }
  return parsed.toISOString();
}

module.exports = { parseDate };
