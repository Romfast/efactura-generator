# eFactura Editor / Editor Facturi Electronice

## Demo
https://romfast.github.io/efactura-generator/

## Overview / Prezentare
Romanian electronic invoice (eFactura) editor - loads XML, allows editing, printing invoices and generates new XML files.

Editor pentru facturi electronice (eFactura) - încarcă fișiere XML, permite editarea, printarea facturilor și generează fișiere XML noi.

## Installation & Usage / Instalare & Utilizare

### Option 1: Web Server / Opțiunea 1: Server Web
Copy all project files to your web server maintaining the directory structure.
Access through your web server URL.
Use "Printează" button to print the invoice.

Copiați toate fișierele pe server păstrând structura directoarelor.
Accesați prin URL-ul serverului.
Folosiți butonul "Printează" pentru a printa factura.

### Option 2: Local Development / Opțiunea 2: Dezvoltare Locală
1. Install Node.js / Instalați Node.js
2. Clone/download repository / Clonați/descărcați repository-ul
3. Run / Rulați: `node server.js`
4. Open / Deschideți: http://localhost:3000

## Project Structure / Structura Proiect
```
project/
├── index.html
├── styles/
│   ├── main.css
│   └── print.css
├── js/
│   ├── script.js
│   ├── formatter.js
│   └── print.js
├── templates/
│   └── print.html
└── server.js
```

## License / Licență
AGPL-3.0-or-later

If you use this software, even as a web service, you must:
1. Give credit to the original project
2. Share all your modifications 
3. Use the same AGPL-3 license

Dacă folosiți acest software, chiar și ca serviciu web, trebuie să:
1. Menționați proiectul original
2. Partajați toate modificările făcute
3. Folosiți aceeași licență AGPL-3