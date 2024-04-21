var xlsx = require('node-xlsx');
var fs = require('fs');
var moment = require('moment');

// Abstract class SpendeeReport
// Saves an excel file with this format:
// Name | Tags | Income | Expense | Date | Note
class SpendeeReport {
  constructor(fileName, outputFileName) {
    if (new.target === SpendeeReport) {
      throw new TypeError("Cannot construct Abstract instances directly");
    }
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
      'FERREJNIOR',
    ],
    'Servicios en Venezuela': [
      'ESTACIONAMIENTO',
      'GANDALF',
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
      'TDD',
    ],
    'Other': [
      'INTERACTIVE BROKERS',
      'BANESCO',
      'PAYONEER',
      'COSMIC STORE',
      'WALDEMAR',
      'ACH',
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
      'PAYPAL',
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
    'Ferreteria': [
      'FERREJNIOR',
    ],
    'Seguro Medico': [
      'MERCANTIL GESTION'
    ],
    'Mercado': [
      'KROMI',
      'CHAKAL',
      'AUTOMERCADO EL PARRAL',
    ],
    'Carnes': [
      'MULTICARNES',
    ],
    'Transferencias Internacionales': [
      'INT ',
      'WALDEMAR',
      'ACH',
    ],
    'Cambio de efectivo': [
      'COSMIC STORE',
    ],
    'Comisiones': [
      'COMISIONES',
      'COMI.',
      'INTERESES',
      'Comision',
      'TDD',
    ],
    'Comida Padres': [
      'SHOPENG',
      'MINI MERCADO',
    ],
    'Servicios de internet': [
      'PAYPAL',
      'GANDALF',
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
  formatIncome(str) {
    var income = Number(str.replace(/,/g, ''));
    if (income < 0) {
      return null;
    }
    return income;
  }
  formatExpense(str) {
    var expense = Number(str.replace(/,/g, ''));
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

var reportMercantil = new MercantilReport('mercantil.xlsx', 'mercantil_report.xlsx');
console.log(reportMercantil.buildExcel());
var reportBanesco = new BanescoReport('banesco.xlsx', 'banesco_report.xlsx');
console.log(reportBanesco.buildExcel());