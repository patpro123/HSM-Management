const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const INPUT_FILE = path.join(__dirname, 'HSM_Students_Data.csv');
const BATCHES_OUTPUT = path.join(__dirname, 'unique_batches.csv');
const TEACHERS_OUTPUT = path.join(__dirname, 'unique_teachers.csv');

// Helper to parse CSV line respecting quotes
function parseCSVLine(text) {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result.map(val => val.replace(/^"|"$/g, '').trim()); // Clean quotes
}

async function extractData() {
    console.log(`Reading from: ${INPUT_FILE}`);
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.error('❌ Error: Source CSV file not found.');
        console.log('Please ensure HSM_Students_Data.csv is in this folder.');
        process.exit(1);
    }

    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const batches = new Map(); // Name -> Count
    const teachers = new Map(); // Name -> Count
    
    let headers = null;
    let day1Idx = -1;
    let day2Idx = -1;
    let teacherIdx = -1;

    for await (const line of rl) {
        if (!line.trim()) continue; // Skip empty lines
        
        const cols = parseCSVLine(line);

        if (!headers) {
            // Only set headers if we find the expected columns (skips empty first lines)
            if (cols.includes('Day 1 Batch') || cols.includes('Day 2 Batch')) {
                headers = cols;
                day1Idx = headers.indexOf('Day 1 Batch');
                day2Idx = headers.indexOf('Day 2 Batch');
                // Look for any column containing 'teacher' or 'faculty' (case-insensitive)
                teacherIdx = headers.findIndex(h => {
                    const lower = h.toLowerCase();
                    return lower.includes('teacher') || lower.includes('faculty');
                });
                console.log('Headers detected:', cols);
            }
            continue;
        }

        // Extract Batches
        [day1Idx, day2Idx].forEach(idx => {
            if (idx !== -1 && cols[idx]) {
                const batch = cols[idx];
                if (batch && batch.toUpperCase() !== 'NULL' && batch !== '') {
                    batches.set(batch, (batches.get(batch) || 0) + 1);
                }
            }
        });

        // Extract Teachers (if column exists)
        if (teacherIdx !== -1 && cols[teacherIdx]) {
            const teacher = cols[teacherIdx];
            if (teacher) {
                teachers.set(teacher, (teachers.get(teacher) || 0) + 1);
            }
        }
    }

    // Write Batches CSV
    const batchStream = fs.createWriteStream(BATCHES_OUTPUT);
    batchStream.write('Batch Name,Student Count,Valid (Y/N),Mapped UUID\n');
    
    const sortedBatches = [...batches.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sortedBatches) {
        batchStream.write(`"${name}",${count},,\n`);
    }
    batchStream.end();
    console.log(`✅ Extracted ${batches.size} unique batches to ${path.basename(BATCHES_OUTPUT)}`);

    // Write Teachers CSV
    const teacherStream = fs.createWriteStream(TEACHERS_OUTPUT);
    teacherStream.write('Teacher Name,Count,Source\n');

    if (teachers.size === 0) {
        console.log('⚠️ No explicit Teacher column found. Inferring from batch names...');
        const ignoreList = ['vocal', 'vocals', 'guitar', 'keyboard', 'drums', 'piano', 'violin', 'batch', 'day', 'online', 'offline', 'morning', 'evening', 'afternoon'];
        
        for (const [batchName, count] of batches) {
            // Heuristic: Take first word of batch name (e.g. "Siva_Batch" -> "Siva")
            const parts = batchName.split(/[_ ]/);
            const first = parts[0];
            if (first && first.length > 2 && !ignoreList.includes(first.toLowerCase()) && isNaN(first)) {
                teachers.set(first, (teachers.get(first) || 0) + count);
            }
        }
    }

    const sortedTeachers = [...teachers.entries()].sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sortedTeachers) {
        teacherStream.write(`"${name}",${count},${teachers.size === 0 ? 'Inferred' : 'Column'}\n`);
    }
    teacherStream.end();
    console.log(`✅ Extracted ${teachers.size} potential teachers to ${path.basename(TEACHERS_OUTPUT)}`);
}

extractData().catch(console.error);