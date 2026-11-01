const fs = require('fs');
const path = require('path');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * Lists and downloads screenshots from a Drive folder. Only ever reads from Drive.
 */
class DriveScreenshotSource {
  constructor({ folderId, clientId, clientSecret, refreshToken, fetch = globalThis.fetch }) {
    for (const [name, value] of Object.entries({ folderId, clientId, clientSecret, refreshToken })) {
      if (!value) throw new Error(`Drive screenshots need ${name}. See .env.example.`);
    }
    this.folderId = folderId;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.refreshToken = refreshToken;
    this.fetch = fetch;
    this.accessToken = '';
  }

  async list({ since }) {
    const query = [
      `'${this.folderId.replace(/'/g, "\\'")}' in parents`,
      "mimeType contains 'image/'",
      'trashed = false',
      `createdTime > '${since}'`,
    ].join(' and ');

    const files = [];
    let pageToken = '';
    do {
      const params = new URLSearchParams({
        q: query,
        pageSize: '200',
        orderBy: 'createdTime',
        fields: 'nextPageToken,files(id,name,createdTime)',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const body = await (await this.#get(`${FILES_URL}?${params}`)).json();
      files.push(...(body.files || []));
      pageToken = body.nextPageToken || '';
    } while (pageToken);
    return files;
  }

  async download(file, directory) {
    const response = await this.#get(`${FILES_URL}/${encodeURIComponent(file.id)}?alt=media`);
    const target = path.join(directory, `${file.id}${path.extname(file.name)}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    return target;
  }

  async #get(url) {
    const response = await this.fetch(url, {
      headers: { Authorization: `Bearer ${await this.#token()}` },
    });
    if (!response.ok) throw new Error(`Google Drive error ${response.status}: ${response.statusText}`);
    return response;
  }

  async #token() {
    if (this.accessToken) return this.accessToken;
    const response = await this.fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new Error(`Google sign-in failed (${response.status}). The refresh token may be revoked.`);
    this.accessToken = (await response.json()).access_token;
    return this.accessToken;
  }
}

/**
 * Same interface for a folder an agent can already reach on disk. The original
 * files are used in place and left untouched.
 */
class LocalScreenshotSource {
  constructor(directory) {
    this.directory = directory;
  }

  async list({ since }) {
    const cutoff = new Date(since).getTime();
    return fs.readdirSync(this.directory)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name) => ({ id: name, name, createdTime: fs.statSync(path.join(this.directory, name)).mtime.toISOString() }))
      .filter((file) => new Date(file.createdTime).getTime() > cutoff)
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime));
  }

  async download(file) {
    return path.join(this.directory, file.name);
  }
}

module.exports = { DriveScreenshotSource, LocalScreenshotSource };
