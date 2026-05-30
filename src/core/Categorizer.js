class Categorizer {
  constructor(categoriesMap, tagsMap, payeesMap = {}) {
    this.categoriesMap = categoriesMap;
    this.tagsMap = tagsMap;
    this.payeesMap = payeesMap;
  }

  categorize(description, fallback = 'Sin Asignar') {
    return this.#match(description, this.categoriesMap) ?? fallback;
  }

  tag(description, fallback = null) {
    return this.#match(description, this.tagsMap) ?? fallback;
  }

  payee(description, fallback = null) {
    return this.#match(description, this.payeesMap) ?? fallback;
  }

  #match(str, map) {
    if (!str) return null;
    for (const key of Object.keys(map)) {
      for (const keyword of map[key]) {
        if (str.indexOf(keyword) > -1) return key;
      }
    }
    return null;
  }
}

module.exports = { Categorizer };
