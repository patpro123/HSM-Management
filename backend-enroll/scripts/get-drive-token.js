/**
 * One-time script to generate a Google Drive OAuth2 refresh token.
 *
 * Run: node scripts/get-drive-token.js
 *
 * Prerequisites:
 *   1. In Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client IDs
 *      → your client → Authorised redirect URIs → add:
 *        http://localhost:3001/oauth2callback
 *   2. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env
 *
 * After running, copy the printed GOOGLE_DRIVE_REFRESH_TOKEN value into .env.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http     = require('http');
const { google } = require('googleapis');

const REDIRECT_URI = 'http://localhost:3002/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope:       ['https://www.googleapis.com/auth/drive.file'],
  prompt:      'consent',   // forces refresh_token to be returned
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Step 1: Open this URL in your browser and sign in with');
console.log('        the Google account that OWNS the Drive folders:');
console.log('\n' + authUrl + '\n');
console.log('Step 2: After authorising, you will be redirected back');
console.log('        automatically and the token will be printed here.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const server = http.createServer(async (req, res) => {
  const url  = new URL(req.url, `http://localhost:3001`);
  const code = url.searchParams.get('code');

  if (!code) {
    res.writeHead(400);
    res.end('No code in request.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h2>Success! You can close this tab and return to the terminal.</h2>');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Add this line to backend-enroll/.env:\n');
    console.log('GOOGLE_DRIVE_REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } catch (err) {
    res.writeHead(500);
    res.end('Token exchange failed: ' + err.message);
    console.error('Error exchanging code:', err.message);
  }

  server.close();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort 3002 is in use. Kill the process on that port and retry:\n  kill $(lsof -ti:3002)\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(3002, () => {
  console.log('Waiting for Google to redirect to http://localhost:3002/oauth2callback …');
});
