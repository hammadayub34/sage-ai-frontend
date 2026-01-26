#!/usr/bin/env node

/**
 * Show exactly which collection and query is used to check for Nissin 1 data
 */

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function showCollectionQuery() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db(dbName);
    
    console.log('📊 COLLECTION BEING CHECKED:');
    console.log('='.repeat(70));
    console.log('Collection Name: labShiftUtilization');
    console.log('Database: admin\n');
    
    // Show the exact query
    const machineName = 'Nissin 1';
    console.log('🔍 QUERY USED:');
    console.log('='.repeat(70));
    console.log('Collection: db.collection("labShiftUtilization")');
    console.log('Query:');
    console.log('  {');
    console.log(`    machine_name: "${machineName}"`);
    console.log('  }');
    console.log('\n');
    
    // Execute the query
    const collection = db.collection('labShiftUtilization');
    const query = { machine_name: machineName };
    
    console.log('📋 EXECUTING QUERY...\n');
    const results = await collection.find(query).toArray();
    
    console.log(`✅ Found ${results.length} records\n`);
    
    if (results.length > 0) {
      // Get the most recent record
      const sorted = results.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      
      const latest = sorted[0];
      
      console.log('📅 MOST RECENT RECORD:');
      console.log('='.repeat(70));
      console.log(JSON.stringify(latest, null, 2));
      
      console.log('\n\n📊 COLLECTION STATISTICS:');
      console.log('='.repeat(70));
      const stats = await collection.countDocuments(query);
      console.log(`Total documents matching query: ${stats}`);
      
      // Get date range
      const dates = results.map(r => r.date).filter(Boolean).sort();
      if (dates.length > 0) {
        console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}`);
        console.log(`Unique dates: ${new Set(dates).size}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

showCollectionQuery().catch(console.error);

