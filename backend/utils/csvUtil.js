/**
 * Converts an array of objects to a CSV string.
 * @param {Array<Object>} data 
 * @returns {string}
 */
function jsonToCsv(data) {
  if (!data || !data.length) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add header
  csvRows.push(headers.join(','));
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Escape commas and quotes if necessary
      const escaped = ('' + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Parses a simple CSV string (one row of data) into an object.
 * Expects headers: lat,lng,incident_type,severity,source
 * @param {string} csvString 
 * @returns {Object}
 */
function csvToJson(csvString) {
  const lines = csvString.trim().split('\n');
  if (lines.length < 2) return {};
  
  const headers = lines[0].split(',').map(h => h.trim());
  const values = lines[1].split(',').map(v => v.trim().replace(/^"(.*)"$/, '$1'));
  
  const obj = {};
  headers.forEach((header, i) => {
    obj[header] = values[i];
  });
  
  return obj;
}

module.exports = { jsonToCsv, csvToJson };
