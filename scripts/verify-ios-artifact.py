from pathlib import Path
from io import BytesIO
import hashlib
import json
import plistlib
import re
import struct
import zipfile

root = Path(__file__).resolve().parent.parent
out = root / 'output'
receipt = json.loads((root / 'reports/ios-artifact-download.json').read_text(encoding='utf-8'))
archive = root / receipt['file']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['sha256']
matching_logs=[]
for log_path in (root/'reports').glob('ios-job-*.log'):
    log_text=log_path.read_text(encoding='utf-8')
    digest=re.search(r'SHA256 digest of uploaded artifact zip is ([a-f0-9]{64})', log_text)
    if digest and digest.group(1)==receipt['sha256']:
        matching_logs.append((log_path,log_text))
assert len(matching_logs)==1, 'Expected one cloud job log matching the artifact SHA-256'
log_path,log=matching_logs[0]
with zipfile.ZipFile(archive) as artifact:
    assert artifact.testzip() is None
    assert artifact.namelist() == ['Chenke-unsigned.ipa'], artifact.namelist()
    data = artifact.read('Chenke-unsigned.ipa')

with zipfile.ZipFile(BytesIO(data)) as ipa:
    assert ipa.testzip() is None
    names = set(ipa.namelist())
    prefix = 'Payload/Chenke.app/'
    required = [prefix + p for p in [
        'Info.plist', 'Chenke', 'Web/index.html', 'Web/app.js', 'Web/style.css',
        'Web/vendor/ocr/lang/chi_sim.traineddata.gz',
        'Web/vendor/ocr/lang/eng.traineddata.gz',
    ]]
    assert all(name in names for name in required)
    info = plistlib.loads(ipa.read(prefix + 'Info.plist'))
    binary = ipa.read(prefix + 'Chenke')
    header = struct.unpack('<IiiIIIII', binary[:32])
    assert header[0] == 0xFEEDFACF and header[1] == 0x0100000C
    assert info['MinimumOSVersion'] == '26.0'
    assert info['CFBundleShortVersionString'] == '0.2.0' and info['CFBundleVersion'] == '3'
    assert info['CFBundleIdentifier'] == 'com.personal.chenke'
    assert info['NSAlarmKitUsageDescription']
    assert b'AlarmKit.framework/AlarmKit' in binary
    assert prefix + 'embedded.mobileprovision' not in names
    offset = 32
    signature_command = False
    for _ in range(header[4]):
        cmd, size = struct.unpack('<II', binary[offset:offset + 8])
        assert size >= 8 and offset + size <= len(binary)
        signature_command |= cmd == 0x1D
        offset += size
    web_files = len([n for n in names if n.startswith(prefix + 'Web/') and not n.endswith('/')])

ipa_file = out / '晨课-iOS-未签名.ipa'
ipa_file.write_bytes(data)
assert '** BUILD SUCCEEDED **' in log
xcode = re.search(r'\bXcode (\d+\.\d+)', log)
report = {
    'repository': 'https://github.com/andijues/chenke-timetable',
    'runId': receipt['runId'],
    'buildUrl': f"https://github.com/andijues/chenke-timetable/actions/runs/{receipt['runId']}",
    'sourceCommit': receipt['commit'],
    'jobId': int(log_path.stem.removeprefix('ios-job-')),
    'build': 'success',
    'xcode': xcode.group(1) if xcode else None,
    'sdk': info.get('DTSDKName'),
    'minimumIOS': info['MinimumOSVersion'],
    'architecture': 'arm64',
    'alarmKitLinked': True,
    'alarmKitPermissionDescriptionPresent': True,
    'webFiles': web_files,
    'artifactZipIntegrity': 'passed',
    'artifactSHA256MatchesCloudUpload': True,
    'ipaZipIntegrity': 'passed',
    'localIPA': str(ipa_file.relative_to(root)).replace('\\', '/'),
    'bytes': len(data),
    'sha256': hashlib.sha256(data).hexdigest(),
    'codeSignatureLoadCommandPresent': signature_command,
    'provisioningProfilePresent': False,
    'appleAccountSigned': False,
    'deviceInstalled': False,
    'lockScreenAlarmTested': False,
    'paidServicesEnabled': False,
    'verifiedAt': receipt['downloadedAt'],
}
(root / 'reports/ios-cloud-build.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
