#!/usr/bin/env node
/**
 * Combined Firestore Seeding Script
 * Supports both test data (synthetic) and production data (from CSV)
 * 
 * Usage:
 *   node seed.js           - Run production seeding (from CSV files)
 *   node seed.js test      - Run test seeding (synthetic data)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = require('./pulsetracker-0000-firebase-adminsdk-fbsvc-182bb21235.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Mode: 'test' or 'production'
const mode = process.argv[2] || 'production';

/**
 * Seed test data with synthetic values
 * Good for development and testing
 */
async function seedTestData() {
  console.log('='.repeat(60));
  console.log('🌱 Seeding Test Data (Synthetic)');
  console.log('='.repeat(60));
  console.log('');

  // 1. Seed state_demographics
  console.log('📊 Seeding state_demographics...');
  const demographics = [
    {
      state: 'Lagos',
      total_population: 15000000,
      voting_age_population: 10000000,
      registered_voters: 7000000,
      political_affiliation: 'Mixed',
      tribal_affiliation: 'Yoruba, Igbo, Hausa'
    },
    {
      state: 'Kano',
      total_population: 12000000,
      voting_age_population: 8000000,
      registered_voters: 5500000,
      political_affiliation: 'APC',
      tribal_affiliation: 'Hausa, Fulani'
    },
    {
      state: 'Rivers',
      total_population: 7000000,
      voting_age_population: 4500000,
      registered_voters: 3200000,
      political_affiliation: 'PDP',
      tribal_affiliation: 'Ijaw, Ikwerre, Ogoni'
    },
    {
      state: 'Abuja',
      total_population: 3500000,
      voting_age_population: 2400000,
      registered_voters: 1800000,
      political_affiliation: 'Mixed',
      tribal_affiliation: 'Mixed'
    }
  ];

  for (const demo of demographics) {
    await db.collection('state_demographics').doc(demo.state).set(demo);
    console.log(`  ✅ Added demographics: ${demo.state}`);
  }

  // 2. Seed approval_ratings (sample historical data)
  console.log('\n📈 Seeding approval_ratings...');
  const candidates = ['Tinubu', 'Obi', 'Atiku'];
  const now = new Date();
  
  let ratingCount = 0;
  for (let i = 30; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    
    for (const candidate of candidates) {
      const baseScore = candidate === 'Tinubu' ? 45 : candidate === 'Obi' ? 35 : 20;
      const variance = Math.random() * 10 - 5; // ±5%
      const rating_score = Math.max(0, Math.min(100, baseScore + variance));
      
      await db.collection('approval_ratings').add({
        timestamp: admin.firestore.Timestamp.fromDate(timestamp),
        candidate,
        rating_score: parseFloat(rating_score.toFixed(2)),
        change_delta: parseFloat((Math.random() * 4 - 2).toFixed(2)),
        state: 'National'
      });
      ratingCount++;
    }
  }
  console.log(`  ✅ Added ${ratingCount} approval ratings`);

  // 3. Seed sentiment_breakdown
  console.log('\n😊 Seeding sentiment_breakdown...');
  for (const candidate of candidates) {
    const positive = Math.random() * 40 + 20; // 20-60%
    const negative = Math.random() * 30 + 10; // 10-40%
    const neutral = 100 - positive - negative;

    await db.collection('sentiment_breakdown').add({
      timestamp: admin.firestore.Timestamp.now(),
      candidate,
      positive: parseFloat((positive / 100).toFixed(2)),
      negative: parseFloat((negative / 100).toFixed(2)),
      neutral: parseFloat((neutral / 100).toFixed(2)),
      trending_phrases: `${candidate} policies, economic growth, security`,
      headlines: `Latest sentiment analysis for ${candidate}`
    });
    console.log(`  ✅ Added sentiment breakdown: ${candidate}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test seeding complete!');
  console.log('='.repeat(60));
  console.log('\n🔗 View your data at:');
  console.log('   https://console.firebase.google.com/project/pulsetracker-0000/firestore');
}

/**
 * Parse CSV file with support for quoted fields
 */
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, i) => {
      row[header.trim()] = values[i] || '';
    });
    return row;
  });
}

/**
 * Process a CSV file and seed Firestore
 */
async function processCSVFile(csvPath, candidate) {
  console.log(`\n📊 Processing ${path.basename(csvPath)} for ${candidate}...`);
  
  const rows = parseCSV(csvPath);
  
  // Group by date
  const dateGroups = {};
  rows.forEach(row => {
    const date = row['Date'];
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(row);
  });
  
  // Process each date
  for (const [dateStr, dateRows] of Object.entries(dateGroups)) {
    const timestamp = admin.firestore.Timestamp.fromDate(new Date(dateStr));
    
    // Extract sentiment data
    let positive = 0, negative = 0, neutral = 0;
    let headlines = '';
    const trendingPhrases = [];
    const examplePosts = [];
    
    dateRows.forEach(row => {
      const category = row['Sentiment Category'];
      const percentage = parseFloat(row['Percentage']) || 0;
      
      if (category === 'Positive') {
        positive = percentage;
      } else if (category === 'Negative') {
        negative = percentage;
      } else if (category === 'Neutral') {
        neutral = percentage;
      } else if (category === 'Headlines') {
        headlines = row['Percentage'];
      }
      
      if (row['Trending Phrases']) {
        trendingPhrases.push(row['Trending Phrases']);
      }
      
      if (row['Example Posts']) {
        examplePosts.push(row['Example Posts']);
      }
    });
    
    // Add sentiment_breakdown document
    await db.collection('sentiment_breakdown').add({
      timestamp,
      candidate,
      positive: positive / 100,
      negative: negative / 100,
      neutral: neutral / 100,
      trending_phrases: trendingPhrases.join('; '),
      headlines: headlines || `${candidate} sentiment data for ${dateStr}`
    });
    
    // Add approval_ratings document
    await db.collection('approval_ratings').add({
      timestamp,
      candidate,
      rating_score: positive,
      change_delta: 0, // Will be calculated by ETL later
      state: 'National'
    });
    
    // Skip adding raw_inputs (would trigger ETL to recalculate)
    // The approval_ratings and sentiment_breakdown above already have the correct data
    
    console.log(`  ✅ ${dateStr}: Approval ${positive}%, Pos:${positive}% Neg:${negative}% Neu:${neutral}%`);
  }
}

/**
 * Seed production data from CSV files
 */
async function seedProductionData() {
  console.log('='.repeat(60));
  console.log('🌱 Seeding Production Data (from CSV files)');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const csvDir = path.join(__dirname, 'data', 'archive');
    
    // Check if CSV files exist
    const obiPath = path.join(csvDir, 'obi.csv');
    const tinubuPath = path.join(csvDir, 'tinubu.csv');
    const atikuPath = path.join(csvDir, 'atiku.csv');
    
    if (!fs.existsSync(obiPath) || !fs.existsSync(tinubuPath) || !fs.existsSync(atikuPath)) {
      console.error('❌ Error: CSV files not found in data/archive/');
      console.error('   Expected files:');
      console.error('   - data/archive/obi.csv');
      console.error('   - data/archive/tinubu.csv');
      console.error('   - data/archive/atiku.csv');
      process.exit(1);
    }
    
    // Process Tinubu data
    await processCSVFile(tinubuPath, 'Tinubu');
    
    // Process Obi data
    await processCSVFile(obiPath, 'Obi');
    
    // Process Atiku data
    await processCSVFile(atikuPath, 'Atiku');
    
        console.log('\n' + '='.repeat(60));
        console.log('✅ Production seeding complete!');
        console.log('='.repeat(60));
        console.log('\n📊 Data populated in Firestore:');
        console.log('   • sentiment_breakdown collection - Monthly sentiment data');
        console.log('   • approval_ratings collection - Monthly approval scores');
        console.log('\n💡 Note: raw_inputs not seeded (would trigger ETL recalculation)');
    console.log('\n🔗 View your data at:');
    console.log('   https://console.firebase.google.com/project/pulsetracker-0000/firestore');
    
  } catch (error) {
    console.error('\n❌ Error seeding data:', error.message);
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('\n');
  
  if (mode === 'test') {
    await seedTestData();
  } else if (mode === 'production') {
    await seedProductionData();
  } else {
    console.error('❌ Invalid mode. Use "test" or "production" (default)');
    console.error('Usage:');
    console.error('  node seed.js           - Production seeding from CSV');
    console.error('  node seed.js test      - Test seeding with synthetic data');
    process.exit(1);
  }
  
  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  });

