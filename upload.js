import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const loadEnv = async () => {
  try {
    const envContent = await fs.readFile(path.join(__dirname, '.env'), 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (error) {
    // If .env doesn't exist, assume environment variables are already set
    console.log('No .env file found, using environment variables');
  }
};

await loadEnv();

// Configuration from environment variables
const CPANEL_USER = process.env.USERNAME;
const CPANEL_HOST = `https://${process.env.SUBDOMAINNAME}.mybluehost.me:2083`;
const AUTH_TOKEN = process.env.BLUEHOSTAPI;
// Allow overriding the home directory base path (default: /home2/)
const HOME_BASE = process.env.HOME_BASE || '/home2';
const PUBLIC_HTML_PATH = `${HOME_BASE}/${CPANEL_USER}/public_html`;

// Validate configuration
if (!CPANEL_USER || !process.env.SUBDOMAINNAME || !AUTH_TOKEN) {
  console.error('ERROR: Missing required environment variables');
  console.error('Please set USERNAME, SUBDOMAINNAME, and BLUEHOSTAPI');
  process.exit(1);
}

const headers = {
  Authorization: `cpanel ${CPANEL_USER}:${AUTH_TOKEN}`,
};

// Generate timestamp in YYYYMMDDHHMMSS format
const getTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Create a directory on the server
async function ensureRemoteDirectory(parentAbsolutePath, dirName) {
  console.log(`Creating directory: ${dirName} in ${parentAbsolutePath}`);
  
  const params = new URLSearchParams({
    cpanel_jsonapi_user: CPANEL_USER,
    cpanel_jsonapi_apiversion: '2',
    cpanel_jsonapi_module: 'Fileman',
    cpanel_jsonapi_func: 'mkdir',
    path: parentAbsolutePath,
    name: dirName,
    permissions: '0755',
  });

  let response;
  try {
    response = await fetch(
      `${CPANEL_HOST}/json-api/cpanel?${params.toString()}`,
      { method: 'GET', headers }
    );
  } catch (fetchError) {
    console.error(`✗ Network error during fetch:`);
    console.error(`  URL: ${CPANEL_HOST}/json-api/cpanel`);
    console.error(`  Error: ${fetchError.message}`);
    throw new Error(`Fetch failed: ${fetchError.message}`);
  }

  if (!response.ok) {
    console.error(`✗ HTTP error: ${response.status} ${response.statusText}`);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  
  if (payload.cpanelresult?.event?.result === 1) {
    console.log(`✓ Directory created successfully: ${dirName}`);
    return true;
  } else if (payload.cpanelresult?.data?.[0]?.reason?.includes('exists')) {
    console.log(`✓ Directory already exists: ${dirName}`);
    return true;
  } else {
    console.error(`✗ Failed to create directory: ${dirName}`);
    console.error(JSON.stringify(payload, null, 2));
    throw new Error('Directory creation failed');
  }
}

// Upload files to the server
async function uploadFiles(remoteDir, localFiles) {
  console.log(`Uploading ${localFiles.length} file(s) to ${remoteDir}`);
  
  const form = new FormData();
  form.set('dir', remoteDir);

  let index = 1;
  for (const filePath of localFiles) {
    const buffer = await fs.readFile(filePath);
    const fileName = path.basename(filePath);
    const file = new File([buffer], fileName, { type: 'text/plain' });
    form.append(`file-${index}`, file);
    console.log(`  - Adding file: ${fileName}`);
    index += 1;
  }

  let response;
  try {
    response = await fetch(
      `${CPANEL_HOST}/execute/Fileman/upload_files`,
      { method: 'POST', headers, body: form }
    );
  } catch (fetchError) {
    console.error(`✗ Network error during fetch:`);
    console.error(`  URL: ${CPANEL_HOST}/execute/Fileman/upload_files`);
    console.error(`  Error: ${fetchError.message}`);
    throw new Error(`Fetch failed: ${fetchError.message}`);
  }

  if (!response.ok) {
    console.error(`✗ HTTP error: ${response.status} ${response.statusText}`);
    const text = await response.text().catch(() => 'Unable to read response');
    console.error(`  Response: ${text}`);
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  
  if (payload.status === 1) {
    console.log(`✓ Files uploaded successfully`);
    return true;
  } else {
    console.error(`✗ Upload failed`);
    console.error(JSON.stringify(payload, null, 2));
    throw new Error('File upload failed');
  }
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('BlueHost cPanel File Upload Script');
  console.log('='.repeat(60));
  console.log(`Target host: ${CPANEL_HOST}`);
  console.log(`User: ${CPANEL_USER}`);
  console.log();

  const timestamp = getTimestamp();
  console.log(`Timestamp: ${timestamp}`);
  console.log();

  // Create temporary directory for local files
  const tempDir = path.join(__dirname, 'temp_upload');
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Step 1: Create file1 (YYYYMMDDHHMMSS.txt) with "hello world"
    const file1Name = `${timestamp}.txt`;
    const file1Path = path.join(tempDir, file1Name);
    await fs.writeFile(file1Path, 'hello world');
    console.log(`[1/4] Created local file: ${file1Name}`);

    // Step 2: Upload file1 to public_html
    await uploadFiles('public_html', [file1Path]);
    console.log(`[2/4] Uploaded ${file1Name} to public_html`);
    console.log();

    // Step 3: Create directory YYYYMMDDHHMMSS_test_dir
    const dirName = `${timestamp}_test_dir`;
    await ensureRemoteDirectory(PUBLIC_HTML_PATH, dirName);
    console.log(`[3/4] Created directory: ${dirName}`);
    console.log();

    // Step 4: Create file2 and upload to the new directory
    const file2Name = `${timestamp}_file2.txt`;
    const file2Path = path.join(tempDir, file2Name);
    await fs.writeFile(file2Path, 'hello world');
    console.log(`Created local file: ${file2Name}`);
    
    await uploadFiles(`public_html/${dirName}`, [file2Path]);
    console.log(`[4/4] Uploaded ${file2Name} to ${dirName}`);
    console.log();

    console.log('='.repeat(60));
    console.log('✓ All operations completed successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('Files created:');
    console.log(`  - public_html/${file1Name}`);
    console.log(`  - public_html/${dirName}/`);
    console.log(`  - public_html/${dirName}/${file2Name}`);
    console.log();

  } catch (error) {
    console.error('='.repeat(60));
    console.error('✗ Error during upload process:');
    console.error(error.message);
    console.error('='.repeat(60));
    process.exit(1);
  } finally {
    // Cleanup temporary files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('Cleaned up temporary files');
    } catch (cleanupError) {
      console.warn('Warning: Could not clean up temporary files');
    }
  }
}

main();
