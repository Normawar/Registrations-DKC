
const fs = require('fs');

const firebaseWebAppConfig = process.env.FIREBASE_WEBAPP_CONFIG;

if (firebaseWebAppConfig) {
  try {
    const config = JSON.parse(firebaseWebAppConfig);
    let envContent = '';
    for (const [key, value] of Object.entries(config)) {
      const envKey = `NEXT_PUBLIC_FIREBASE_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
      envContent += `${envKey}="${value}"
`;
    }
    fs.writeFileSync('.env', envContent);
    console.log('Successfully created .env file from FIREBASE_WEBAPP_CONFIG');
  } catch (error) {
    console.error('Failed to parse FIREBASE_WEBAPP_CONFIG:', error);
    process.exit(1);
  }
} else {
  console.log('FIREBASE_WEBAPP_CONFIG not found, skipping .env file creation.');
}
