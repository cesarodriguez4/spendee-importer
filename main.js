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

  categoryObj = {
    'Comida para la casa': [
      'KROMI',
      'CHAKAL',
      'MULTICARNES',
      'AUTOMERCADO EL PARRAL',
      'AWADA',
      'ALIMENTOS',
      'BARAKI',
    ],
    'Beraca': [
      'MULTIMAX',
    ],
    'Servicios en Venezuela': [
      'ESTACIONAMIENTO',
    ],
    'Comida en la calle': [
      'SUSHI',
      'CEBICHES',
      'PISTAZIE',
      'TOKYO',
      'CINES',
      'PANAD'
    ],
    'Comisiones': [
      'COMISIONES',
      'COMI.',
      'INTERESES',
      'Comision',
    ],
    'Other': [
      'INTERACTIVE BROKERS',
      'BANESCO',
      'PAYONEER',
      'COSMIC STORE',
    ],
    'Salud': [
      'FARMACIA',
      'MERCANTIL GESTION',
    ],
    'Lujos': [
      'PAGO TDC',
      'AMZN',
    ],
    'Servicios de Internet': [
      'HEROKU',
    ],
    'Ropa': [
      'ENGANCHATE',
      'GRUPO TOTAL',
    ],
    'Travel': [
      'CAMAGUAN',
      'APURE',
    ]
  }

  tagsObj = {
    'Baraki': [
      'BARAKI'
    ],
    'Seguro Medico': [
      'MERCANTIL GESTION'
    ],
    'Transferencias Internacionales': [
      'INT ',
    ],
  }

  buildExcel(data) {
      var data = this.model();
      var buffer = xlsx.build([{name: "mySheetName", data: data}]);
      fs.writeFileSync(__dirname + '/' + this.outputFileName, buffer);
      return 'Excel file created';
  }
  extractEntities(str, list) {
    for (var key in list) {
      for (var i = 0; i < list[key].length; i++) {
        if (str.indexOf(list[key][i]) > -1) {
          return key;
        }
      }
    }
  }
}

class MercantilReport extends SpendeeReport {
  constructor(reportType, fileName, outputFileName) {
    super(reportType, fileName, outputFileName);
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

var report = new MercantilReport('mercantil', 'mercantil.xlsx', 'mercantil_report.xlsx');
console.log(report.buildExcel());