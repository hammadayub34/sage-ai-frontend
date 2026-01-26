#!/usr/bin/env node

/**
 * Check if CARE lab has machines in the database
 */

const { MongoClient, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://wiser:wiser%40123@3.208.198.4:27017';
const dbName = 'admin';

async function checkCareLabMachines() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db(dbName);
    const labsCollection = db.collection('labs');
    const machinesCollection = db.collection('machines');

    // Find CARE lab
    const careLab = await labsCollection.findOne({
      name: { $regex: /CARE/i }
    });

    if (!careLab) {
      console.log('❌ CARE lab not found in database.');
      console.log('\n📋 Available labs:');
      const allLabs = await labsCollection.find({}).toArray();
      allLabs.forEach((lab, idx) => {
        console.log(`   ${idx + 1}. ${lab.name} (ID: ${lab._id})`);
      });
      return;
    }

    console.log(`📋 CARE Lab Found:`);
    console.log(`   Name: ${careLab.name}`);
    console.log(`   ID (string): ${careLab._id.toString()}`);
    console.log(`   ID (ObjectId): ${careLab._id}`);
    console.log('');

    // Try to find machines with different labId formats
    const labIdString = careLab._id.toString();
    let labObjectId;
    try {
      labObjectId = new ObjectId(careLab._id);
    } catch {
      labObjectId = null;
    }

    console.log('🔍 Searching for machines...\n');

    // Search with string ID
    const machinesByString = await machinesCollection.find({
      labId: labIdString
    }).toArray();

    console.log(`📊 Machines found with labId as string (${labIdString}): ${machinesByString.length}`);
    if (machinesByString.length > 0) {
      machinesByString.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.machineName} (ID: ${m._id}, labId: ${m.labId})`);
      });
    }

    // Search with ObjectId
    if (labObjectId) {
      const machinesByObjectId = await machinesCollection.find({
        labId: labObjectId
      }).toArray();

      console.log(`\n📊 Machines found with labId as ObjectId: ${machinesByObjectId.length}`);
      if (machinesByObjectId.length > 0) {
        machinesByObjectId.forEach((m, idx) => {
          console.log(`   ${idx + 1}. ${m.machineName} (ID: ${m._id}, labId: ${m.labId})`);
        });
      }
    }

    // Search with $or query (like the API does)
    const machinesWithOr = await machinesCollection.find({
      $or: [
        { labId: labIdString },
        ...(labObjectId ? [{ labId: labObjectId }] : [])
      ]
    }).toArray();

    console.log(`\n📊 Machines found with $or query: ${machinesWithOr.length}`);
    if (machinesWithOr.length > 0) {
      machinesWithOr.forEach((m, idx) => {
        console.log(`   ${idx + 1}. ${m.machineName} (ID: ${m._id})`);
        console.log(`      labId type: ${typeof m.labId}, value: ${m.labId}`);
        console.log(`      labId matches string? ${m.labId === labIdString || m.labId?.toString() === labIdString}`);
        console.log(`      labId matches ObjectId? ${m.labId?.equals?.(labObjectId) || false}`);
      });
    } else {
      console.log('\n❌ No machines found for CARE lab.');
      console.log('\n🔍 Checking all machines in database to see labId formats...');
      const allMachines = await machinesCollection.find({}).limit(5).toArray();
      if (allMachines.length > 0) {
        console.log('\nSample machines (first 5):');
        allMachines.forEach((m, idx) => {
          console.log(`   ${idx + 1}. ${m.machineName}`);
          console.log(`      labId: ${m.labId} (type: ${typeof m.labId}, isObjectId: ${m.labId instanceof ObjectId})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
  }
}

checkCareLabMachines().catch(console.error);

