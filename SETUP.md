# Setup Guide

## Local Development

1. **Create environment file**
   ```bash
   cp .env.example .env
   ```

2. **Configure your BlueHost credentials** in `.env`:
   - `USERNAME`: Your cPanel username
   - `SUBDOMAINNAME`: Your BlueHost subdomain (e.g., `your-subdomain.mybluehost.me`)
   - `BLUEHOSTAPI`: Your cPanel API token

3. **Run the upload script**
   ```bash
   npm run upload
   ```

## GitHub Actions Setup

To use the automated workflow, you need to add three secrets to your GitHub repository:

1. **Navigate to your repository settings**:
   - Go to `Settings` → `Secrets and variables` → `Actions`

2. **Add the following repository secrets**:
   - `USERNAME`: Your cPanel username
   - `SUBDOMAINNAME`: Your BlueHost subdomain (without `https://` and `:2083`)
   - `BLUEHOSTAPI`: Your cPanel API token

3. **Trigger the workflow**:
   - Go to `Actions` tab
   - Select "test upload" workflow
   - Click "Run workflow"
   - Optionally provide a reason for the upload

## What the Script Does

The upload script will:

1. Generate a timestamp in `YYYYMMDDHHMMSS` format
2. Create and upload a file named `YYYYMMDDHHMMSS.txt` containing "hello world" to `public_html/`
3. Create a directory named `YYYYMMDDHHMMSS_test_dir/` in `public_html/`
4. Create and upload a file named `YYYYMMDDHHMMSS_file2.txt` containing "hello world" to the newly created directory

## Getting Your cPanel API Token

1. Log in to your cPanel account
2. Navigate to "Security" → "Manage API Tokens"
3. Create a new token with appropriate permissions
4. Copy the token and store it securely

> **Warning**: Never commit your API token or `.env` file to version control!
