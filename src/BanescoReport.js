const { SpendeeReport } = require('./SpendeeReport');
var moment = require('moment');

class BanescoReport extends SpendeeReport {
    constructor(fileName, outputFileName) {
      super(fileName, outputFileName);
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
      formattedData.push(head);
      var prunedData = data.filter(function(e) { return e.length > 0; });
      for (var i = 8; i < prunedData.length; i++) {
          var row = prunedData[i];
          formattedData.push([
              this.formatDate(row[1]),
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
      return this.extractEntities(str, this.categoryObj) || 'Padres';
    }
    formatTags(str) {
      return this.extractEntities(str, this.tagsObj) || 'Padres';
    }
    formatIncome(income) {
      if (typeof income === 'string') {
        income = Number(income.replace(/,/g, ''));
      }
      if (income < 0) {
        return null;
      }
      return income;
    }
    formatExpense(expense) {
      if (typeof expense === 'string') {
        expense = Number(expense.replace(/,/g, ''));
      }
      if (expense > 0) {
        return null;
      }
      return expense;
    }
    formatDate(str) {
      var output = moment(str, 'DD/MM/YYYY', 'es').toISOString();
      return output;
    }
  }

module.exports = {
  BanescoReport
}