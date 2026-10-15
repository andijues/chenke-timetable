import { webview } from '@kit.ArkWeb';
import { common } from '@kit.AbilityKit';
import { picker } from '@kit.CoreFileKit';
import { HarmonyBridge } from '../HarmonyBridge';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: HarmonyBridge = new HarmonyBridge(getContext(this) as common.UIAbilityContext, this.controller);
  private pageReady: boolean = false;
  private foregroundHandler: () => void = () => {
    this.runPageScript('window.chenkeNativeResume && window.chenkeNativeResume();');
  };
  aboutToAppear(): void {
    (getContext(this) as common.UIAbilityContext).eventHub.on('chenkeForeground', this.foregroundHandler);
  }
  aboutToDisappear(): void {
    (getContext(this) as common.UIAbilityContext).eventHub.off('chenkeForeground', this.foregroundHandler);
  }
  onBackPress(): boolean {
    if (!this.pageReady || !this.bridge.shouldHandleBack()) return false;
    this.runPageScript('window.chenkeNativeBack && window.chenkeNativeBack();');
    return true;
  }
  private runPageScript(script: string): void {
    // runJavaScript can throw synchronously before the Web component attaches.
    if (!this.pageReady) return;
    try { this.controller.runJavaScript(script).catch(() => {}); } catch { }
  }
  onPageShow(): void {
    this.runPageScript('window.chenkeNativeResume && window.chenkeNativeResume();');
  }
  private localResponse(url: string): WebResourceResponse {
    const response = new WebResourceResponse();
    const context = getContext(this) as common.UIAbilityContext;
    try {
      const path = decodeURIComponent(url.replace('https://chenke.local/v3/', '').split('?')[0]);
      if (path.includes('..') || path.includes('\\')) throw new Error('路径无效');
      const bytes = context.resourceManager.getRawFileContentSync(`web/${path || 'index.html'}`);
      response.setResponseData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      response.setResponseEncoding('UTF-8');
      response.setResponseMimeType(path.endsWith('.html') ? 'text/html' : path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.wasm') ? 'application/wasm' : path.endsWith('.json') || path.endsWith('.webmanifest') ? 'application/json' : 'application/octet-stream');
      response.setResponseHeader([{headerKey: 'Access-Control-Allow-Origin', headerValue: '*'}]);
      response.setResponseCode(200); response.setReasonMessage('OK');
    } catch {
      response.setResponseData(''); response.setResponseCode(404); response.setReasonMessage('Not Found');
    }
    return response;
  }
  build() {
    Column() {
      // Virtual HTTPS origin is entirely served from bundled raw files. No website/server is contacted.
      Web({src: 'https://chenke.local/v3/index.html', controller: this.controller})
        .javaScriptAccess(true).domStorageAccess(true).fileAccess(true)
        .javaScriptProxy({object: this.bridge, name: 'HarmonyBridge', methodList: ['postMessage'], controller: this.controller})
        .onInterceptRequest(event => {
          if (!event) return new WebResourceResponse();
          return this.localResponse(event.request.getRequestUrl());
        })
        .onShowFileSelector(event => {
          if (!event) return false;
          const dialog = new picker.DocumentViewPicker(getContext(this) as common.UIAbilityContext);
          const options = new picker.DocumentSelectOptions(); options.maxSelectNumber = 1;
          dialog.select(options).then(uris => event.result.handleFileList(uris)).catch(() => event.result.handleFileList([]));
          return true;
        })
        .onPageBegin(() => { this.pageReady = false; })
        .onPageEnd(() => {
          this.pageReady = true;
          this.runPageScript("window.__chenkePlatform='harmony';window.chenkeNativeReady&&window.chenkeNativeReady();");
        })
        .width('100%').height('100%')
    }.width('100%').height('100%').backgroundColor('#F5F7F6')
  }
}
