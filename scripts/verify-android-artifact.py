from pathlib import Path
import hashlib
import json
import subprocess
import zipfile
import gzip
import argparse
import os

root = Path(__file__).resolve().parent.parent
record = json.loads((root/'reports/android-build.json').read_text(encoding='utf-8'))
package = root/record['artifact']
assert hashlib.sha256(package.read_bytes()).hexdigest() == record['sha256']
with zipfile.ZipFile(package) as apk:
    assert apk.testzip() is None
    names = apk.namelist()
    required = ['AndroidManifest.xml','classes.dex','resources.arsc','assets/web/index.html',
        'assets/web/app.js','assets/web/style.css','assets/web/offline-resources.json',
        'assets/web/vendor/ocr/lang/chi_sim.traineddata','assets/web/vendor/ocr/lang/eng.traineddata']
    assert all(p in names for p in required)
    dex = b''.join(apk.read(p) for p in names if p.startswith('classes') and p.endswith('.dex'))
    assert dex.startswith(b'dex\n')
    for name in [b'MainActivity',b'AlarmStore',b'AlarmReceiver',b'RestoreReceiver',b'RingService',b'RingActivity',b'AlarmTime',b'BundledPage',b'ResourcePolicy']:
        assert name in dex, name
    assert not any(n.lower().endswith(('.p12','.p7b','.keystore','.jks','.pem','.csr')) for n in names)
    for name in ['app.js','style.css']:
        assert apk.read('assets/web/'+name) == (root/'dist'/name).read_bytes(), 'APK shared UI is stale'
    for lang in ['chi_sim','eng']:
        assert apk.read('assets/web/vendor/ocr/lang/'+lang+'.traineddata') == gzip.decompress((root/'dist/vendor/ocr/lang'/ (lang+'.traineddata.gz')).read_bytes()), 'Packaged OCR model is incomplete'
    count = sum(n.startswith('assets/web/') and not n.endswith('/') for n in names)
sdk = Path(record['sdk'])
tools = sdk/'build-tools/35.0.0'
args = argparse.ArgumentParser()
args.add_argument('--java')
options = args.parse_args()
java_path = options.java or record.get('javaHome') or os.environ.get('JAVA_HOME')
assert java_path, 'Supply --java or JAVA_HOME matching the build JDK'
java = Path(java_path)
# Invoke the official Java signer directly so shell paths cannot change arguments.
verify = subprocess.run([str(java/'bin/java.exe'),'-jar',str(tools/'lib/apksigner.jar'),'verify','--verbose','--print-certs',str(package)],
    check=True,capture_output=True,text=True,encoding='utf-8',errors='replace')
assert 'Verified using v2 scheme (APK Signature Scheme v2): true' in verify.stdout
manifest = subprocess.run([str(tools/'aapt2.exe'),'dump','badging',str(package)],
    check=True,capture_output=True,text=True,encoding='utf-8',errors='replace').stdout
assert "name='com.andijues.chenke'" in manifest and ("versionName='"+record['version']+"'") in manifest
assert "minSdkVersion:'26'" in manifest and "targetSdkVersion:'36'" in manifest
for permission in ['SCHEDULE_EXACT_ALARM','POST_NOTIFICATIONS','RECEIVE_BOOT_COMPLETED','FOREGROUND_SERVICE_MEDIA_PLAYBACK','USE_FULL_SCREEN_INTENT']:
    assert permission in manifest, permission
device_path = root/'reports/android-compatibility-test.json'
device_evidence = json.loads(device_path.read_text(encoding='utf-8')) if device_path.exists() else {}
device_result = next((attempt for attempt in device_evidence.get('attempts', []) if attempt.get('sha256') == record['sha256']), {})
record.update({'zipIntegrity':'passed','officialSignatureVerification':'passed','signatureSchemeV2':True,
    'manifestVerified':True,'compiledDex':True,'offlineWebFiles':count,'sharedUIHashMatches':True,
    'javaHome':str(java),'deviceInstalled':bool(device_result.get('installed')),
    'homepageVerified':bool(device_result.get('homepageVerified')),
    'lockScreenAlarmTested':bool(device_result.get('lockScreenAlarmTested')),
    'deviceTestEnvironment':device_evidence.get('testEnvironment') if device_result else None})
(root/'reports/android-build.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'reports/android-apksigner.txt').write_text(verify.stdout,encoding='utf-8')
print(json.dumps(record,ensure_ascii=False,indent=2))
