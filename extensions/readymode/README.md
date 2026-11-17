# BYLDA ReadyMode Call Importer

1. Extract the ZIP, open `chrome://extensions`, enable **Developer mode**, and choose **Load unpacked**. Select this folder (containing `manifest.json`). Pin BYLDA to Chrome's toolbar.
2. Open BYLDA → Integrations → ReadyMode → Chrome extension. Choose a rep and create a connection code. Paste the code into the extension importer and save it.
3. Open your ReadyMode Call Logs or call detail. Load the calls you want, then click BYLDA in Chrome. Only calls loaded on that page are scanned, up to 100 per scan.
4. Review the calls/transcripts, select calls, confirm permission, and import. Keep the importer tab open until uploads finish.

Available page transcripts and TXT/VTT/SRT downloads are imported. Otherwise, recordings are uploaded privately and transcribed by BYLDA. If ReadyMode hides a recording URL, play/open that recording first, or attach the downloaded file in the importer. Add a call manually using a stable ReadyMode call ID when the page exposes no readable call row. Files: MP3, MP4, M4A, WAV, WebM, OGG, FLAC, up to 100 MB. Transcripts: up to 100,000 characters. Empty or unavailable transcripts need a recording.

## Privacy and access

- Scans only when clicked. No always-running content script, microphone capture, cookie reading, or ReadyMode password collection.
- Requests access to specific recording/transcript origins when you import. Supported hosts are ReadyMode/Xencall and their S3/CloudFront media links. Redirecting downloads must be downloaded manually and attached; authenticated playback depends on your ReadyMode permissions.
- Sends only selected calls to the BYLDA Supabase endpoint. Workspace import tokens are stored in trusted extension-local storage; BYLDA stores only their hashes. Tokens cannot read workspace data, expire after 30 days, and can be revoked or replaced in Integrations.
- Call-page scans are held in Chrome session storage only until the importer opens. Selected files and edits stay in the importer tab's memory. Forgetting a connection removes its local token; revoke it in BYLDA to disable other copies.
- This is an unpacked Chrome extension, not a Chrome Web Store listing. It does not claim continuous background syncing or a private ReadyMode API. ReadyMode permissions still govern which recordings you can download.

Repeated imports use the same workspace + ReadyMode host + call ID, so retrying a failed upload or queue request reuses the existing call. Imports by a different member for the same call are rejected with an explicit message. Connection codes assign calls to the selected BYLDA rep.
