
const fs = require('fs');

const firebaseWebAppConfig = process.env.FIREBASE_WEBAPP_CONFIG;
const geminiApiKey = process.env.GEMINI_API_KEY;

let envContent = '';

if (firebaseWebAppConfig) {
  try {
    const config = JSON.parse(firebaseWebAppConfig);
    for (const [key, value] of Object.entries(config)) {
      const envKey = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      envContent += `${envKey}="${value}"\n`;
    }
    console.log('Successfully created .env file from FIREBASE_WEBAPP_CONFIG');
  } catch (error) {
    console.error('Failed to parse FIREBASE_WEBAPP_CONFIG:', error);
    process.exit(1);
  }
} else {
  console.log('FIREBASE_WEBAPP_CONFIG not found, skipping .env file creation.');
}

if (geminiApiKey) {
  envContent += `GEMINI_API_KEY=${geminiApiKey}\n`;
  console.log('Successfully added GEMINI_API_KEY to .env file.');
} else {
  console.log('GEMINI_API_KEY not found, skipping addition to .env file.');
}

if (envContent) {
  fs.writeFileSync('.env', envContent);
  console.log('Successfully wrote to .env file');
} else {
  console.log('No environment variables to write, skipping .env file creation.');
}
