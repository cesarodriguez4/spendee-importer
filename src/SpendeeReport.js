var xlsx = require('node-xlsx');
var fs = require('fs');

class SpendeeReport {
    constructor(fileName, outputFileName, withBS) {
      if (new.target === SpendeeReport) {
        throw new TypeError("Cannot construct Abstract instances directly");
      }
      this.fileName = fileName;
      this.worksheet = xlsx.parse(__dirname + "/.." + '/' +fileName);
      this.outputFileName = outputFileName;
      // Exchange rate from Bs to USD
      this.withBS = Number(withBS);
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
        'MAXICARNE',
      ],
      'Beraca': [
        'MULTIMAX',
        'FERREJNIOR',
      ],
      'Servicios en Venezuela': [
        'ESTACIONAMIENTO',
        'GANDALF',
        'DLOSTARLINK',
        'MOVISTAR',
        'DIGITEL',
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
        'ANUALIDAD',
        'Comision',
        'TDD',
        'ITBMS',
        'COM.',
        'EMISION',
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
        'UNIVERSITAS',
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
        'TRF.MB',
        'TRF',
        'PAYONEER',
        'INTERNA',
        'TRANS.CTAS. A TERCEROS BANESCO',
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
      ],
      'P2P': [
        'P2P',
      ],
    }

    tagsObj = {
      'Baraki': [
        'BARAKI'
      ],
      'Pago movil': [
        'Banesco Pago Movil',
      ],
      'Punto de venta': [
        'POS',
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
      'Retiro de Binance': [
        'TRANS.CTAS. A TERCEROS BANESCO',
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
        var buffer = xlsx.build([{name: "mySheetName", data}]);
        fs.writeFileSync(__dirname + '/..' +  '/exports/' + this.outputFileName, buffer);
        return 'Excel file created for ' + this.fileName;
    }
    extractEntities(str, list) {
      if (!str) {
        return null;
      }
      for (var key in list) {
        for (var i = 0; i < list[key].length; i++) {
          if (str.indexOf(list[key][i]) > -1) {
            return key;
          }
        }
      }
    }
    convertToUSD(amount) {
      return Number(amount) / this.withBS;
    }

  }

module.exports = {
  SpendeeReport
}