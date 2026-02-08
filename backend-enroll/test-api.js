#!/usr/bin/env node

const http = require('http');

function testEndpoint(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

function postEndpoint(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}


async function main() {
  console.log('Testing Enrollment API endpoints...\n');
  
  try {
    console.log('1. GET /api/instruments');
    const instruments = await testEndpoint('/api/instruments');
    console.log(`   Found ${instruments.instruments?.length || 0} instruments:`);
    instruments.instruments?.slice(0, 3).forEach(i => {
      console.log(`   - ${i.name} (max batch: ${i.max_batch_size}, online: ${i.online_supported})`);
    });
    
    console.log('\n2. GET /api/batches');
    const batches = await testEndpoint('/api/batches');
    console.log(`   Found ${batches.batches?.length || 0} batches:`);
    batches.batches?.slice(0, 3).forEach(b => {
      console.log(`   - ${b.instrument_name}: ${b.recurrence} (Teacher: ${b.teacher_name})`);
    });
    
    console.log('\n3. GET /api/enrollments');
    const enrollments = await testEndpoint('/api/enrollments');
    console.log(`   Found ${enrollments.enrollments?.length || 0} enrollments`);

    console.log('\n4. POST /api/students (Create Student)');
    const newStudentPayload = {
      first_name: 'Test',
      last_name: `User-${Date.now()}`,
      email: `test.user.${Date.now()}@example.com`,
    };
    const newStudentResult = await postEndpoint('/api/students', newStudentPayload);
    if (newStudentResult && newStudentResult.student && newStudentResult.student.id) {
      console.log(`   ✅ Student created successfully with ID: ${newStudentResult.student.id}`);
    } else {
      console.error('   ❌ Failed to create student.', newStudentResult);
      throw new Error('Student creation failed');
    }
    
    console.log('\n✅ All endpoints working!');
  } catch(err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
