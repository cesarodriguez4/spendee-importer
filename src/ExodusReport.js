const { SpendeeReport } = require('./SpendeeReport');
var fs = require('fs');
var xlsx = require('node-xlsx');
var moment = require('moment');

class ExodusReport extends SpendeeReport {
    constructor(fileName, startDate, endDate) {
        super(fileName);
        this.startDate = startDate;
        this.endDate = endDate;
    }
    model(data) {
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
      if (!data) {
        return formattedData;
      }
      for (var i = 0; i < data.length; i++) {
          var row = data[i];
          var date = row[0];
          var transactionUrl = row[10] || row[14];
          var personalNote = row[16] || '';
          var outAmount = row[4];
          var inAmount = row[11];
          if (inAmount && !outAmount && Number(inAmount) == 0 || !inAmount && outAmount && Number(outAmount) == 0) {
            continue;
          }
          formattedData.push([
              this.formatDate(date),
              this.formatName(`${transactionUrl} ${personalNote}`),
              'Transferencias',
              '',
              this.formatExpense(outAmount),
              this.formatIncome(inAmount),
          ]);
      }
      return formattedData;
    }

    buildExcel(data, fileName) {
        var buffer = xlsx.build([{name: "mySheetName", data}]);
        fs.writeFileSync(__dirname + '/..' +  '/exports/' + fileName, buffer);
        return 'Exodus: Excel file created for ' + fileName;
    }

    exportFilesToExcel() {
      const exodusUSDC = this.exportExodusUSDC();
      const trezorBTC = this.exportTrezorBTC();
      const exodusUSDT = this.exportExodusUSDT();
      const trezorETH = this.exportTrezorETH();
      this.buildExcel(exodusUSDC, 'exodusUSDC_report.xlsx');
      this.buildExcel(trezorBTC, 'trezorBTC_report.xlsx');
      this.buildExcel(exodusUSDT, 'exodusUSDT_report.xlsx');
      this.buildExcel(trezorETH, 'trezorETH_report.xlsx');
      return 'Exodus: Excel files created';
    }

    filter({data, currency, startDate, endDate, wallet}) {
      if (!startDate || !endDate) {
      throw new Error('startDate and endDate are required');
      }
      return data.filter(row => {
      const dateRow = row[0];
      const walletRow = row[2] || row[3];
      const currencyRow = row[5] || row[12];
      const date = moment(dateRow, 'YYYY-MM-DD HH:mm:ss');
      const isDateInRange = date.isSameOrAfter(moment(startDate)) && date.isSameOrBefore(moment(endDate));
      const isCurrencyMatch = !currency || currencyRow === currency;
      const isWalletMatch = !wallet || walletRow === wallet;
      return isDateInRange && isCurrencyMatch && isWalletMatch;
      });
    }

    exportExodusUSDT() {
      var data = this.worksheet[0].data;
      data = this.filter(
        {
          data,
          currency: 'USDT',
          startDate: this.startDate,
          endDate: this.endDate,
          wallet: 'exodus_0',
        }
      );
     return this.model(data);
    }

    exportExodusUSDC() {
      var data = this.worksheet[0].data;
      const filteredData = this.filter(
        {
          data,
          currency: 'USDC',
          startDate: this.startDate,
          endDate: this.endDate,
          wallet: 'exodus_0',
        }
      );
      return this.model(filteredData);
    }

    exportTrezorBTC() {
      var data = this.worksheet[0].data;
      data = this.filter(
        {
          data,
          currency: 'BTC',
          startDate: this.startDate,
          endDate: this.endDate,
          wallet: 'trezor_0_067f5db394a2374e33db8ea4014fdf37'
        }
      );
      return this.model(data);
    }

    exportTrezorETH() {
      var data = this.worksheet[0].data;
      data = this.filter(
        {
          data,
          currency: 'ETH',
          startDate: this.startDate,
          endDate: this.endDate,
          wallet: 'trezor_0_067f5db394a2374e33db8ea4014fdf37'
        }
      );
      return this.model(data);
    }

    filterByCurrency(data, currency) {
      return data.filter(row => row[5] === currency);
    }

    filterByDate(data, startDate, endDate) {
      return data.filter(row => {
        const date = moment(row[0], 'YYYY-MM-DD HH:mm:ss');
        return date.isSameOrAfter(startDate) && date.isSameOrBefore(endDate);
      });
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
  ExodusReport
}