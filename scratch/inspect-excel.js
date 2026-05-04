const xlsx = require('xlsx');
try {
    const wb = xlsx.readFile('kkk.xlsx');
    const sheetName = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
    if (data.length > 0) {
        console.log("Colonnes disponibles dans kkk.xlsx:", Object.keys(data[0]));
        console.log("Exemple de ligne:", data[0]);
    } else {
        console.log("Le fichier est vide.");
    }
} catch (err) {
    console.error(err.message);
}
