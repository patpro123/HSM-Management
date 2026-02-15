const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, 'HSM_Students_Data.csv');

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headers = lines[1].split(',').map(h => h.trim().toUpperCase()); // Header is on line 2 based on file preview
  const leftColIndex = headers.indexOf('LEFT');
  
  const uniqueData = {
    courses: new Set(),
    batches: new Set(),
    paymentCycles: new Set(),
    professions: new Set(),
    localities: new Set()
  };

  // Start from line 2 (index 2) to skip empty first line and header
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV split (doesn't handle quoted commas perfectly, but sufficient for this dataset structure)
    const row = line.split(',');
    
    // Map based on observed indices
    // Name(1), Email(3), Locality(5), Profession(7), Course(8), Day1(9), Day2(10), Payment(11)
    
    const locality = row[5];
    const profession = row[7];
    const course = row[8];
    const batch1 = row[9];
    const batch2 = row[10];
    const payment = row[11];
    
    // Check if student is active
    let isActive = true;
    if (leftColIndex !== -1 && row[leftColIndex]) {
      const leftVal = row[leftColIndex].trim().toUpperCase();
      if (leftVal === 'YES' || leftVal === 'TRUE') {
        isActive = false;
      }
    }

    if (course) uniqueData.courses.add(course.trim());
    if (payment) uniqueData.paymentCycles.add(payment.trim());
    if (profession) uniqueData.professions.add(profession.trim());
    if (locality) uniqueData.localities.add(locality.trim());

    // Only collect batches for active students
    if (isActive) {
      if (batch1) uniqueData.batches.add(batch1.trim());
      if (batch2) uniqueData.batches.add(batch2.trim());
    }
  }

  return uniqueData;
}

try {
  console.log(`Reading ${csvPath}...`);
  const data = parseCSV(csvPath);
  
  console.log('\n--- UNIQUE COURSES (Instruments) ---');
  console.log([...data.courses].sort());

  console.log('\n--- UNIQUE PAYMENT CYCLES ---');
  console.log([...data.paymentCycles].sort());

  console.log('\n--- UNIQUE BATCHES (Active Students Only) ---');
  console.log([...data.batches].sort());
  
  console.log('\n--- SUMMARY ---');
  console.log(`Found ${data.batches.size} unique batch identifiers (filtered for active students).`);
  console.log('Please create these batches in the system and create a batch_mapping.json file.');
} catch (err) {
  console.error('Error reading CSV:', err.message);
}