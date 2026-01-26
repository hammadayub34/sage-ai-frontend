/**
 * Browser Console Test Script
 * 
 * Copy and paste this into your browser console (F12) when on the work order form page
 * to test the API performance directly from the browser
 */

async function testWorkOrderFill() {
  const machineId = 'machine-01';
  const alarmType = 'AlarmLowProductLevel';
  const machineType = 'bottlefiller';
  
  console.log('🧪 Testing Work Order Fill API');
  console.log(`   Machine ID: ${machineId}`);
  console.log(`   Alarm Type: ${alarmType}`);
  console.log(`   Machine Type: ${machineType}`);
  console.log('');
  
  const payload = {
    machineId,
    alarmType,
    machineType
  };
  
  // Measure total time
  const startTime = performance.now();
  
  try {
    console.log('📡 Sending request to API...');
    const response = await fetch('/api/work-order/pinecone-fill', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    const totalTime = performance.now() - startTime;
    console.log(`✅ Response received in ${totalTime.toFixed(2)}ms`);
    console.log('');
    
    if (response.ok) {
      const data = await response.json();
      
      // Show timings if available
      if (data.timings) {
        const timings = data.timings;
        console.log('⏱️  Performance Breakdown:');
        console.log(`   Total Time:     ${timings.total.toFixed(2)}ms`);
        console.log(`   Embedding:      ${timings.embedding.toFixed(2)}ms (${(timings.embedding / timings.total * 100).toFixed(1)}%)`);
        console.log(`   Pinecone Query: ${timings.pinecone.toFixed(2)}ms (${(timings.pinecone / timings.total * 100).toFixed(1)}%)`);
        console.log(`   LLM Completion: ${timings.llm.toFixed(2)}ms (${(timings.llm / timings.total * 100).toFixed(1)}%)`);
        console.log('');
        
        // Identify bottleneck
        const maxTime = Math.max(timings.embedding, timings.pinecone, timings.llm);
        
        if (timings.llm === maxTime) {
          console.log('🐌 Bottleneck: LLM Completion (this is normal - LLM calls are typically the slowest)');
        } else if (timings.pinecone === maxTime) {
          console.log('🐌 Bottleneck: Pinecone Query');
        } else if (timings.embedding === maxTime) {
          console.log('🐌 Bottleneck: Embedding Creation');
        }
        console.log('');
      }
      
      // Show success status
      if (data.success) {
        console.log('✅ Success: Work order data extracted');
        const workOrder = data.workOrder || {};
        
        // Show what was extracted
        console.log('\n📋 Extracted Data:');
        if (workOrder.workDescription) {
          const descPreview = workOrder.workDescription.length > 100 
            ? workOrder.workDescription.substring(0, 100) + '...' 
            : workOrder.workDescription;
          console.log(`   Work Description: ${descPreview}`);
        }
        
        if (workOrder.specialInstructions) {
          const instPreview = workOrder.specialInstructions.length > 100 
            ? workOrder.specialInstructions.substring(0, 100) + '...' 
            : workOrder.specialInstructions;
          console.log(`   Special Instructions: ${instPreview}`);
        }
        
        if (workOrder.parts) {
          console.log(`   Parts: ${workOrder.parts.length} items`);
        }
        
        if (workOrder.materials) {
          console.log(`   Materials: ${workOrder.materials.length} items`);
        }
        
        return data;
      } else {
        console.log(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ HTTP Error: ${response.status}`);
      console.log(`   Error: ${errorData.error || 'Unknown error'}`);
    }
  } catch (error) {
    const totalTime = performance.now() - startTime;
    console.log(`❌ Error after ${totalTime.toFixed(2)}ms:`, error);
  }
}

// Run the test
testWorkOrderFill();

