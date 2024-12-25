const { SpendeeReport } = require('./SpendeeReport');
var moment = require('moment');

class BinanceReport extends SpendeeReport {
    constructor(fileName, outputFileName) {
      super(fileName, outputFileName);
    }
    model() {
      var data = this.worksheet[0].data;
      // csv: [ 'User_ID', 'UTC_Time', 'Account', 'Operation', 'Coin', 'Change', 'Remark' ]
      var excludeAccounts = ['Spot'];
      var excludeOperations = ['Transfer Between Main and Funding Wallet'];
      var allowedCoins = ['USDT'];
      data = data.filter(row => !excludeAccounts.includes(row[2]) && !excludeOperations.includes(row[3]) && allowedCoins.includes(row[4]));
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
      for (var i = 0; i < data.length; i++) {
          var row = data[i];
          formattedData.push([
              this.formatDate(row[1]),
              this.formatName(row[6]),
              this.formatCategory(row[6]),
              this.formatTags(row[6]),
              this.formatExpense(row[5]),
              this.formatIncome(row[5]),
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
        const income = Number(str);
        if (income > 0) {
            return income;
        }
        return null;
    }
    formatExpense(str) {
        const expense = Number(str);
        if (expense < 0) {
        return expense;
        }
        return null;
    }
    formatDate(str) {
      var output = moment(str, 'YYYY-MM-DD HH:mm:ss')
      .toISOString();
      return output;
    }
}

module.exports = {
  BinanceReport
}