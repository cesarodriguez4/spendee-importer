var xlsx = require('node-xlsx');
var fs = require('fs');
var moment = require('moment');

// Abstract class SpendeeReport
// Saves an excel file with this format:
// Name | Tags | Income | Expense | Date | Note
class SpendeeReport {
  constructor(reportType, fileName, outputFileName) {
    if (new.target === SpendeeReport) {
      throw new TypeError("Cannot construct Abstract instances directly");
    }
    this.type = reportType;
    this.fileName = fileName;
    this.worksheet = xlsx.parse(__dirname + '/' +fileName);
    this.outputFileName = outputFileName;
  }
    buildExcel(data) {
        var data = this.model();
        var buffer = xlsx.build([{name: "mySheetName", data: data}]);
        fs.writeFileSync(__dirname + '/' + this.outputFileName, buffer);
        return 'Excel file created';
    }
}

// Mercantil report has this format:
// Date | Description | Reference | Expense | Income
class MercantilReport extends SpendeeReport {
  constructor(reportType, fileName, outputFileName) {
    super(reportType, fileName, outputFileName);
  }
  model() {
    var data = this.worksheet[0].data;
    var formattedData = [];
    // First row is the header
    var head = [
      'Fecha',
      'Descripción',
      'Categoría',
      'Tags',
      'Gasto',
      'Ingreso',
      'Nota'
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
            this.formatNote(row[5])
        ]);
    }
    return formattedData;
  }

  formatName(str) {
    return str;
  }
  formatCategory(str) {
    var keys = {
      'Comida para la casa': [
        'KROMI',
        'CHAKAL',
        'MULTICARNES',
        'AUTOMERCADO EL PARRAL'
      ],
      'Comisiones': [
        'COMISIONES',
        'COMI.',
        'INTERESES',
        'Comision'
      ],
      'Other': [
        'INTERACTIVE BROKERS',
        'BANESCO',
      ],
      'Salud': [
        'FARMACIA',
        'MERCANTIL GESTION',
      ],
      'Lujos': [
        'PAGO TDC',
      ]
    }
    for (var key in keys) {
      for (var i = 0; i < keys[key].length; i++) {
        if (str.indexOf(keys[key][i]) > -1) {
          return key;
        }
      }
    }
  }
  formatTags(str) {
    var keys = {
      'Baraki': [
        'BARAKI'
      ],
    }
    for (var key in keys) {
      for (var i = 0; i < keys[key].length; i++) {
        if (str.indexOf(keys[key][i]) > -1) {
          return key;
        }
      }
    }
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
  formatNote(str) {
    return str;
  }
}

var report = new MercantilReport('mercantil', 'mercantil.xlsx', 'mercantil_report.xlsx');
console.log(report.buildExcel());