const { SpendeeReport } = require('./SpendeeReport');
var moment = require('moment');

class BanescoVEReport extends SpendeeReport {
    constructor(fileName, outputFileName, withBS) {
      super(fileName, outputFileName, withBS);
      if (!withBS) {
        throw new Error('Please provide the exchange rate from Bs to USD');
      }
    }
    model() {
      var data = this.worksheet[0].data;
      var formattedData = [];
      var head = [
        'Fecha',
        'Descripción',
        'Categoría',
        'Tags',
        'Gasto',
        'Ingreso',
      ]
      formattedData.push(head)
      var prunedData = data.filter(function(e) { return e.length > 0; });
      for (var i = 1; i < prunedData.length; i++) {
          var row = prunedData[i];
          formattedData.push([
              this.formatDate(row[0]),
              this.formatName(row[2]),
              this.formatCategory(row[2]),
              this.formatTags(row[2]),
              this.formatExpense(row[3]),
              this.formatIncome(row[3]),
          ]);
      }

      return formattedData;
    }

    formatName(str) {
      return str;
    }
    formatCategory(str) {
      return this.extractEntities(str, this.categoryObj) || 'Sin Asignar';
    }
    formatTags(str) {
      return this.extractEntities(str, this.tagsObj);
    }
    formatIncome(income) {
      if (typeof income === 'string') {
        income = Number(income.replace(/\./g, '').replace(/,/g, '.'));
      }
      if (income < 0) {
        return null;
      }
      return this.convertToUSD(income);
    }
    formatExpense(expense) {
      if (typeof expense === 'string') {
        expense = Number(expense.replace(/\./g, '').replace(/,/g, '.'));
      }
      if (expense > 0) {
        return null;
      }
      return this.convertToUSD(expense);
    }
    formatDate(str) {
      var output = moment(str, 'YYYY/MM/DD', 'es').toISOString();
      return output;
    }
  }

module.exports = {
  BanescoVEReport
}