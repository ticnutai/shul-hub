import socket
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

_original_getaddrinfo = socket.getaddrinfo


def _ipv4_getaddrinfo(*args, **kwargs):
    results = _original_getaddrinfo(*args, **kwargs)
    ipv4 = [result for result in results if result[0] == socket.AF_INET]
    return ipv4 or results


socket.getaddrinfo = _ipv4_getaddrinfo

KEY_FILE = r"scripts\google-play-service-account.json"
PACKAGE = "com.ticnutai.bsr3synagogue"
AAB_PATH = r"android\app\build\outputs\bundle\release\app-release.aab"
TRACK = sys.argv[1] if len(sys.argv) > 1 else "internal"

if TRACK != "internal":
    raise SystemExit("This app is currently restricted to the internal testing track")

credentials = service_account.Credentials.from_service_account_file(
    KEY_FILE, scopes=["https://www.googleapis.com/auth/androidpublisher"]
)
service = build("androidpublisher", "v3", credentials=credentials)
edit = service.edits().insert(body={}, packageName=PACKAGE).execute()
edit_id = edit["id"]
bundle = service.edits().bundles().upload(
    packageName=PACKAGE,
    editId=edit_id,
    media_body=MediaFileUpload(AAB_PATH, mimetype="application/octet-stream", resumable=True),
).execute()
version_code = str(bundle["versionCode"])
service.edits().tracks().update(
    packageName=PACKAGE,
    editId=edit_id,
    track=TRACK,
    body={
        "releases": [
            {
                "versionCodes": [version_code],
                "status": "completed",
                "releaseNotes": [
                    {"language": "he-IL", "text": "גרסת בדיקה ראשונה של בית כנסת בסר 3"},
                    {"language": "en-US", "text": "First internal test release of BSR 3 Synagogue"},
                ],
            }
        ]
    },
).execute()
service.edits().commit(packageName=PACKAGE, editId=edit_id).execute()
print(f"SUCCESS: versionCode {version_code} uploaded to {TRACK}")
