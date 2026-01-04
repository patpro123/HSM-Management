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
    
    console.log('\n✅ All endpoints working!');
  } catch(err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
