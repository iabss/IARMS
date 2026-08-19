async function run() {
  const url = "https://docs.google.com/spreadsheets/d/1i_UnpKnVYrG0PxKGTWXV0bgu7zGficLh/export?format=csv&gid=1293981214";
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  
  function parseCSV(text: string) {
    const result: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(field.trim());
          field = "";
        } else if (c === '\n' || (c === '\r' && text[i+1] === '\n')) {
          row.push(field.trim());
          result.push(row);
          row = [];
          field = "";
          if (c === '\r') i++;
        } else {
          field += c;
        }
      }
    }
    if (field || row.length) {
      row.push(field.trim());
      result.push(row);
    }
    return result;
  }

  const rows = parseCSV(text);
  const sample = rows[3];
  if (sample) {
    sample.forEach((val, idx) => {
      console.log(`Col ${idx} [${rows[2][idx] || ''}]: ${val.replace(/\n/g, ' ')}`);
    });
  }
}

run();
