# howToUploadFilesToBlueHostViaCpanelAPI


This guide explains how to upload files to BlueHost programmatically using the cPanel API

---

## Prerequisites

1. **Node.js 18+** (required for native `fetch` API)
2. **BlueHost cPanel API Token** (stored in `.env` as `BLUEHOSTAPI`)
3. **cPanel credentials**:
   - Host: `https://<your-subdomain>.mybluehost.me:2083` (stored in `.env` as `SUBDOMAINNAME`)
   - Username: Your cPanel username
   - Public HTML path: `/home2/<username>/public_html` (stored in `.env` as `USERNAME`)

---

## Authentication

All cPanel API requests require an **Authorization header**:

```javascript
const headers = {
  Authorization: `cpanel ${CPANEL_USER}:${AUTH_TOKEN}`,
};
```

> [!IMPORTANT]
> Never commit your API token to version control. Use environment variables.

---

## Core Operations

### 1. Creating Remote Directories

Use the **Fileman/mkdir** API to create directories on the server:

```javascript
async function ensureRemoteDirectory(parentAbsolutePath, dirName) {
  const params = new URLSearchParams({
    cpanel_jsonapi_user: CPANEL_USER,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: "Fileman",
    cpanel_jsonapi_func: "mkdir",
    path: parentAbsolutePath,      // e.g., "/home2/username/public_html"
    name: dirName,                 // e.g., "my-folder"
    permissions: "0755",
  });

  const response = await fetch(
    `${CPANEL_HOST}/json-api/cpanel?${params.toString()}`,
    { method: "GET", headers }
  );

  const payload = await response.json();
  // Check payload.cpanelresult.event.result === 1 for success
}
```

| Parameter     | Description                              |
|---------------|------------------------------------------|
| `path`        | Absolute path to the parent directory    |
| `name`        | Name of the new directory to create      |
| `permissions` | Unix permissions (typically `0755`)      |

---

### 2. Uploading Files

Use the **Fileman/upload_files** API endpoint with `FormData`:

```javascript
async function uploadFiles(remoteDir, localFiles) {
  const form = new FormData();
  form.set("dir", remoteDir);  // e.g., "public_html/my-folder"

  let index = 1;
  for (const filePath of localFiles) {
    const buffer = await fs.readFile(filePath);
    form.append(`file-${index}`, new Blob([buffer]), path.basename(filePath));
    index += 1;
  }

  const response = await fetch(
    `${CPANEL_HOST}/execute/Fileman/upload_files`,
    { method: "POST", headers, body: form }
  );

  const payload = await response.json();
  // Check payload.status === 1 for success
}
```

> [!NOTE]
> The `dir` field uses a **relative path** from your home directory (e.g., `public_html/folder`), not an absolute path.

---

### 3. Deleting Files

Use the **Fileman/fileop** API with the `unlink` operation to delete files from the server:

```javascript
async function deleteRemoteFile(relativePathFromHome) {
  const params = new URLSearchParams({
    cpanel_jsonapi_user: CPANEL_USER,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: "Fileman",
    cpanel_jsonapi_func: "fileop",
    op: "unlink",
    sourcefiles: relativePathFromHome,  // e.g., "public_html/my-folder/file.txt"
    doubledecode: "0",
  });

  const response = await fetch(
    `${CPANEL_HOST}/json-api/cpanel?${params.toString()}`,
    { method: "GET", headers }
  );

  const payload = await response.json();
  // Check payload.cpanelresult.event.result === 1 for success
  // Check payload.cpanelresult.data for per-file errors
}
```

| Parameter     | Description                                          |
|---------------|------------------------------------------------------|
| `op`          | Operation type: `unlink` for file deletion           |
| `sourcefiles` | Relative path to the file from home directory        |
| `doubledecode`| Set to `"0"` to prevent double URL decoding          |

> [!WARNING]
> File deletion is irreversible. Always verify the file path before deletion.

---

### 4. Deleting Directories

Use the **Fileman/fileop** API with the `rmdir` operation to delete directories:

```javascript
async function deleteRemoteDirectory(dirPath) {
  const params = new URLSearchParams({
    cpanel_jsonapi_user: CPANEL_USER,
    cpanel_jsonapi_apiversion: "2",
    cpanel_jsonapi_module: "Fileman",
    cpanel_jsonapi_func: "fileop",
    op: "rmdir",
    sourcefiles: dirPath,  // e.g., "public_html/old-folder"
  });

  const response = await fetch(
    `${CPANEL_HOST}/json-api/cpanel?${params.toString()}`,
    { method: "GET", headers }
  );

  const payload = await response.json();
  // Check response.ok for success
  // Directory removal may fail silently if directory is not empty
}
```

| Parameter     | Description                                          |
|---------------|------------------------------------------------------|
| `op`          | Operation type: `rmdir` for directory removal        |
| `sourcefiles` | Relative path to the directory from home directory   |

> [!WARNING]
> Directory deletion is irreversible. The directory must be empty before deletion. Delete all files in the directory first using the file deletion operation.

---

## Error Handling Tips

| Error                              | Cause                                    |
|------------------------------------|------------------------------------------|
| `mkdir request failed (403)`       | Invalid API token or permissions         |
| `Upload failed with status 413`    | File too large for server limits         |
| `Directory already exists`         | Safe to ignore, script handles this      |
| `Missing fetch API`                | Node.js version < 18                     |


---

## Quick Reference: API Endpoints

| Operation       | Endpoint                                      | Method |
|-----------------|-----------------------------------------------|--------|
| Create folder   | `/json-api/cpanel?...Fileman/mkdir`           | GET    |
| Upload files    | `/execute/Fileman/upload_files`               | POST   |
| Delete file     | `/json-api/cpanel?...Fileman/fileop&op=unlink`| GET    |
| Delete directory| `/json-api/cpanel?...Fileman/fileop&op=rmdir` | GET    |

---

## See Also

- [cPanel UAPI Documentation](https://api.docs.cpanel.net/cpanel/introduction/)

---

## Example Usage

This repository includes a working example script (`upload.js`) and GitHub Actions workflow for automated file uploads.

### Local Usage

1. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your BlueHost credentials:
   ```
   USERNAME=your_cpanel_username
   SUBDOMAINNAME=your-subdomain
   BLUEHOSTAPI=your_api_token_here
   ```

3. Run the upload script:
   ```bash
   npm run upload
   ```

The script will:
- Create a file `YYYYMMDDHHMMSS.txt` with "hello world" in `public_html/`
- Create a directory `YYYYMMDDHHMMSS_test_dir/` in `public_html/`
- Create a file `YYYYMMDDHHMMSS_file2.txt` with "hello world" inside the directory

### GitHub Actions Usage

The repository includes a workflow named "test upload" that can be manually triggered.

1. Add secrets to your repository:
   - `USERNAME` - Your cPanel username
   - `SUBDOMAINNAME` - Your BlueHost subdomain (e.g., `your-subdomain` without `.mybluehost.me`)
   - `BLUEHOSTAPI` - Your cPanel API token

2. Go to Actions → "test upload" → "Run workflow"

3. The workflow will automatically run the upload script with the same behavior as local usage.
