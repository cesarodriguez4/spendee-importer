
const { Categorizer } = require('../src/core/Categorizer');

const categories = {
  Comida: ['KROMI', 'CHAKAL'],
  Transferencias: ['ACH', 'TRF'],
};
const tags = {
  Mercado: ['KROMI'],
};
const payees = {
  'Supermercado Kromi': ['KROMI'],
  'Banco ACH': ['ACH'],
};

describe('Categorizer', () => {
  const categorizer = new Categorizer(categories, tags);

  it('matches the first keyword found in a category', () => {
    expect(categorizer.categorize('Compra en KROMI sucursal 5')).toBe('Comida');
  });

  it('matches across multiple categories', () => {
    expect(categorizer.categorize('TRF a Juan')).toBe('Transferencias');
  });

  it('returns the fallback when no keyword matches', () => {
    expect(categorizer.categorize('Algo no mapeado', 'Sin Asignar')).toBe('Sin Asignar');
  });

  it('returns null tag when no match and no fallback', () => {
    expect(categorizer.tag('Nada')).toBeNull();
  });

  it('returns tag fallback when no match', () => {
    expect(categorizer.tag('Nada', 'Padres')).toBe('Padres');
  });

  it('returns null fallback when description is empty', () => {
    expect(categorizer.categorize('', 'Sin Asignar')).toBe('Sin Asignar');
    expect(categorizer.categorize(null, 'Sin Asignar')).toBe('Sin Asignar');
  });

  it('assigns a payee from the payees map', () => {
    const withPayees = new Categorizer(categories, tags, payees);
    expect(withPayees.payee('Compra en KROMI sucursal 5')).toBe('Supermercado Kromi');
    expect(withPayees.payee('ACH a Juan')).toBe('Banco ACH');
  });

  it('returns null payee when no match and no payees configured', () => {
    expect(categorizer.payee('Algo no mapeado')).toBeNull();
  });

  it('returns the payee fallback when no match', () => {
    const withPayees = new Categorizer(categories, tags, payees);
    expect(withPayees.payee('Sin coincidencia', 'Desconocido')).toBe('Desconocido');
  });
});
