const xlsx = require('xlsx');
const filename = 'Production_Global  du 2025-01-01 au 2026-05-02.xlsx';
try {
    const wb = xlsx.readFile(filename);
    const sheetName = wb.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName]);
    if (data.length > 0) {
        console.log("Colonnes disponibles:", Object.keys(data[0]));
        console.log("Nombre de lignes:", data.length);
        console.log("Exemple de ligne:", data[0]);
    } else {
        console.log("Le fichier est vide.");
    }
} catch (err) {
    console.error(err.message);
}
