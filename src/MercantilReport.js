const { SpendeeReport } = require('./SpendeeReport');
var moment = require('moment');

class MercantilReport extends SpendeeReport {
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
      for (var i = 2; i < data.length; i++) {
          var row = data[i];
          formattedData.push([
              this.formatDate(row[0]),
              this.formatName(row[1]),
              this.formatCategory(row[1]),
              this.formatTags(row[1]),
              this.formatExpense(row[3]),
              this.formatIncome(row[4]),
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
    formatIncome(str) {
      return str;
    }
    formatExpense(str) {
      return str;
    }
    formatDate(str) {
      var output = moment(str, 'DD/MMM/YYYY', 'es').toISOString();
      return output;
    }
}

module.exports = {
  MercantilReport
}