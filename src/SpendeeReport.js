var xlsx = require('node-xlsx');
var fs = require('fs');

class SpendeeReport {
    constructor(fileName, outputFileName) {
      if (new.target === SpendeeReport) {
        throw new TypeError("Cannot construct Abstract instances directly");
      }
      this.fileName = fileName;
      this.worksheet = xlsx.parse(__dirname + "/../" + '/' +fileName);
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
        'DLOSTARLINK',
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
        'ITBMS',
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
      'Transferencias': [
        'INT ',
        'WALDEMAR',
        'ACH',
        'COSMIC',
      ],
      'Servicios de Internet': [
        'HEROKU',
        'PAYPAL',
        'OPENAI',
      ],
      'Ropa': [
        'ENGANCHATE',
        'GRUPO TOTAL',
      ],
      'Travel': [
        'CAMAGUAN',
        'APURE',
      ],
      'Meriva': [
        'ERASMO'
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
        'ITBMS',
      ],
      'Comida Padres': [
        'SHOPENG',
        'MINI MERCADO',
        'PAN PAST Y CHARCT B',
        'MERCATENERIFE',
        'INVERSIONES TABACO',
        'EL CHACAL NAGANAGA',
      ],
      'Servicios de internet': [
        'PAYPAL',
        'GANDALF',
        'DLOSTARLINK',
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

module.exports = {
  SpendeeReport
}