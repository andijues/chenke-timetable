import SwiftUI
import WebKit
import UniformTypeIdentifiers
import PDFKit
import Vision
import AlarmKit

@main
struct ChenkeApp: App {
    var body: some Scene {
        WindowGroup { ChenkeWebView().background(Color(uiColor: .systemBackground)).ignoresSafeArea(.keyboard) }
    }
}

struct CourseAlarmMetadata: AlarmMetadata {
    let course: String
}

struct ChenkeWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "chenke")
        config.userContentController.addUserScript(WKUserScript(source: "window.__chenkePlatform='ios';", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = .systemBackground
        web.scrollView.contentInsetAdjustmentBehavior = .never
        context.coordinator.web = web
        if let folder = Bundle.main.url(forResource: "Web", withExtension: nil) {
            web.loadFileURL(folder.appendingPathComponent("index.html"), allowingReadAccessTo: folder)
        }
        return web
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, UIDocumentPickerDelegate {
        weak var web: WKWebView?
        private var pickerRequest: String?
        private let alarmService = CourseAlarmService()
        private var dataURL: URL {
            FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("chenke.json")
        }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
                  let object = message.body as? [String: Any], let id = object["id"] as? String,
                  let action = object["action"] as? String else { return }
            let payload = object["payload"] as? [String: Any] ?? [:]
            Task {
                do {
                    let result = try await handle(action, payload: payload, id: id)
                    if let result { reply(id, data: result) }
                } catch { reply(id, error: error.localizedDescription) }
            }
        }
        func handle(_ action: String, payload: [String: Any], id: String) async throws -> [String: Any]? {
            switch action {
            case "capabilities":
                return ["platform": "ios", "supported": true, "mode": "pending", "message": "iOS AlarmKit 就绪；启用后会请求系统闹钟权限。"]
            case "saveState":
                guard let state = payload["state"] as? [String: Any] else { throw AppError("课表格式错误") }
                let data = try JSONSerialization.data(withJSONObject: state)
                try FileManager.default.createDirectory(at: dataURL.deletingLastPathComponent(), withIntermediateDirectories: true)
                try data.write(to: dataURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                return ["saved": true]
            case "loadState":
                guard FileManager.default.fileExists(atPath: dataURL.path) else { return [:] }
                return ["state": try JSONSerialization.jsonObject(with: Data(contentsOf: dataURL))]
            case "syncAlarms":
                guard let plans = payload["plans"] as? [[String: Any]], plans.count <= 28 else { throw AppError("起床计划数量或格式不正确") }
                return try await alarmService.reconcile(plans)
            case "testAlarm":
                return try await alarmService.test()
            case "pickDocument":
                guard pickerRequest == nil else { throw AppError("文件选择器已打开") }
                pickerRequest = id
                let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf, .image], asCopy: true)
                picker.delegate = self; picker.allowsMultipleSelection = false
                presenter?.present(picker, animated: true)
                return nil
            case "exportFile":
                guard let name = payload["name"] as? String, let text = payload["text"] as? String, text.utf8.count < 5_000_000 else { throw AppError("导出文件无效") }
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(URL(fileURLWithPath: name).lastPathComponent)
                try Data(text.utf8).write(to: url, options: .atomic)
                let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                share.popoverPresentationController?.sourceView = web
                presenter?.present(share, animated: true)
                return ["exported": true]
            default: throw AppError("未支持的设备操作")
            }
        }
        private var presenter: UIViewController? {
            var current = web?.window?.rootViewController
            while let presented = current?.presentedViewController { current = presented }
            return current
        }
        func reply(_ id: String, data: [String: Any] = [:], error: String? = nil) {
            let value: [String: Any] = error.map { ["id": id, "error": $0] } ?? ["id": id, "data": data]
            guard let bytes = try? JSONSerialization.data(withJSONObject: value), let json = String(data: bytes, encoding: .utf8) else { return }
            web?.evaluateJavaScript("window.chenkeNativeResult(\(json));", completionHandler: nil)
        }
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            if let id = pickerRequest { reply(id, error: "已取消文件选择") }; pickerRequest = nil
        }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let id = pickerRequest, let url = urls.first else { return }; pickerRequest = nil
            Task {
                do {
                    let result = try await Task.detached(priority: .userInitiated) { try NativeDocumentReader.read(url) }.value
                    reply(id, data: result)
                } catch { reply(id, error: error.localizedDescription) }
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.isFileURL || url.scheme == "about" { decisionHandler(.allow) }
            else { decisionHandler(.cancel); if url.scheme == "shortcuts" { UIApplication.shared.open(url) } }
        }
    }
}

struct AppError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

enum NativeDocumentReader {
    static func read(_ url: URL) throws -> [String: Any] {
        let access = url.startAccessingSecurityScopedResource(); defer { if access { url.stopAccessingSecurityScopedResource() } }
        let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size <= 30 * 1024 * 1024 else { throw AppError("文件超过 30 MB，请拆分后导入") }
        if url.pathExtension.lowercased() == "pdf" {
            guard let document = PDFDocument(url: url), !document.isLocked else { throw AppError("PDF 无法读取或已加密，请解除密码后重试") }
            guard document.pageCount <= 25 else { throw AppError("PDF 超过 25 页，请只保留课表页") }
            var pages: [[String: Any]] = []; var usedOCR = false
            for index in 0..<document.pageCount {
                guard let page = document.page(at: index) else { continue }
                let bounds = page.bounds(for: .mediaBox)
                var items: [[String: Any]] = []
                let text = page.string ?? ""
                if text.filter({ !$0.isWhitespace }).count >= 15 {
                    // Character selections preserve table coordinates; group adjacent characters into words per line.
                    var buffer = ""; var rect = CGRect.null
                    func flush() {
                        guard !buffer.trimmingCharacters(in: .whitespaces).isEmpty else { buffer = ""; rect = .null; return }
                        items.append(["text": buffer, "x": rect.minX, "y": bounds.height - rect.maxY, "width": rect.width, "height": rect.height])
                        buffer = ""; rect = .null
                    }
                    for n in 0..<page.numberOfCharacters {
                        guard let selection = page.selection(for: NSRange(location: n, length: 1)), let char = selection.string else { continue }
                        let next = selection.bounds(for: page)
                        if char == "\n" || char == "\r" { flush(); continue }
                        if !rect.isNull && (abs(next.midY - rect.midY) > max(5, rect.height * 0.4) || next.minX - rect.maxX > max(8, rect.height)) { flush() }
                        buffer += char; rect = rect.union(next)
                    }
                    flush()
                    pages.append(["text": text, "items": items, "width": bounds.width, "height": bounds.height])
                } else {
                    usedOCR = true
                    let scale = min(2.2, 2600 / max(bounds.width, bounds.height))
                    let image = page.thumbnail(of: CGSize(width: bounds.width * scale, height: bounds.height * scale), for: .mediaBox)
                    guard let cg = image.cgImage else { throw AppError("扫描 PDF 无法渲染") }
                    pages.append(try recognize(cg))
                }
            }
            return ["pages": pages, "text": pages.compactMap { $0["text"] as? String }.joined(separator: "\n\n"), "name": url.lastPathComponent, "kind": usedOCR ? "ocr" : "text"]
        }
        guard let original = UIImage(contentsOfFile: url.path) else { throw AppError("图片无法读取，请选择 PNG 或 JPG") }
        let normalized = original.imageOrientation == .up ? original : UIGraphicsImageRenderer(size: original.size).image { _ in original.draw(in: CGRect(origin: .zero, size: original.size)) }
        guard let image = normalized.cgImage else { throw AppError("图片方向无法读取，请导出 PNG 后重试") }
        let page = try recognize(image)
        return ["pages": [page], "text": page["text"] ?? "", "name": url.lastPathComponent, "kind": "ocr"]
    }
    static func recognize(_ image: CGImage) throws -> [String: Any] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate; request.recognitionLanguages = ["zh-Hans", "en-US"]; request.usesLanguageCorrection = false
        try VNImageRequestHandler(cgImage: image).perform([request])
        let width = Double(image.width), height = Double(image.height)
        let results = request.results ?? []
        let items: [[String: Any]] = results.compactMap { observation in
            guard let text = observation.topCandidates(1).first?.string else { return nil }
            let b = observation.boundingBox
            return ["text": text, "x": b.minX * width, "y": (1 - b.maxY) * height, "width": b.width * width, "height": b.height * height]
        }
        return ["items": items, "text": results.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n"), "width": width, "height": height]
    }
}

@MainActor
final class CourseAlarmService {
    private let ledgerKey = "chenke.alarms.v1"
    private var ledger: [String: [String: String]] {
        get { UserDefaults.standard.dictionary(forKey: ledgerKey) as? [String: [String: String]] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: ledgerKey) }
    }
    private func authorized() async throws {
        var authorization = AlarmManager.shared.authorizationState
        if authorization == .notDetermined { authorization = try await AlarmManager.shared.requestAuthorization() }
        guard authorization == .authorized else { throw AppError("系统闹钟权限未开启，请在 iPhone 设置中允许晨课使用闹钟") }
    }
    private func parseDate(_ value: String) -> Date? {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: value)
    }
    private func publish(_ id: UUID, date: Date, course: String) async throws {
        let stop = AlarmButton(text: "关闭", textColor: .white, systemImageName: "stop.circle")
        let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: "该起床啦 · \(course)"), stopButton: stop)
        let attributes = AlarmAttributes(presentation: AlarmPresentation(alert: alert), metadata: CourseAlarmMetadata(course: course), tintColor: Color.green)
        let configuration = AlarmManager.AlarmConfiguration<CourseAlarmMetadata>(schedule: .fixed(date), attributes: attributes)
        _ = try await AlarmManager.shared.schedule(id: id, configuration: configuration)
    }
    func reconcile(_ plans: [[String: Any]]) async throws -> [String: Any] {
        if !plans.isEmpty { try await authorized() }
        var records = ledger
        let valid = try plans.map { plan -> (String, Date, String, String) in
            guard let key = plan["id"] as? String, key.hasPrefix("chenke-"), let raw = plan["fireAt"] as? String,
                  let date = parseDate(raw), date > Date(), date < Date().addingTimeInterval(30 * 86400), let course = plan["course"] as? String else { throw AppError("起床计划无效或已过期") }
            return (key, date, raw, course)
        }
        let desired = Set(valid.map { $0.0 })
        let active: Set<UUID>
        if records.isEmpty && valid.isEmpty { active = [] }
        else {
            do { active = Set(try AlarmManager.shared.alarms.map { $0.id }) }
            catch { throw AppError("无法确认现有系统闹钟，保留原记录，请检查权限后重新更新：\(error.localizedDescription)") }
        }
        for (key, record) in records where !desired.contains(key) {
            if let id = UUID(uuidString: record["uuid"] ?? ""), active.contains(id) { try AlarmManager.shared.cancel(id: id) }
            records.removeValue(forKey: key); ledger = records
        }
        for (key, date, raw, course) in valid {
            let old = records[key]
            let id = UUID(uuidString: old?["uuid"] ?? "") ?? UUID()
            if old?["fireAt"] == raw && old?["course"] == course && active.contains(id) { continue }
            if active.contains(id) { try AlarmManager.shared.cancel(id: id) }
            do {
                try await publish(id, date: date, course: course)
                records[key] = ["uuid": id.uuidString, "fireAt": raw, "course": course]; ledger = records
            } catch { throw AppError("仅完成 \(records.count) 个闹钟。系统拒绝了 \(course)：\(error.localizedDescription)。请点击更新重试。") }
        }
        return ["mode": "alarm", "scheduled": valid.count, "message": valid.isEmpty ? "本应用的起床闹钟已取消或当前无晨课。" : "系统已接受未来起床闹钟；关闭应用后由系统触发。"]
    }
    func test() async throws -> [String: Any] {
        try await authorized()
        var records = ledger
        if let id = UUID(uuidString: records["chenke-test"]?["uuid"] ?? "") { try? AlarmManager.shared.cancel(id: id) }
        let id = UUID(); let date = Date().addingTimeInterval(60)
        try await publish(id, date: date, course: "一分钟测试")
        records["chenke-test"] = ["uuid": id.uuidString, "fireAt": ISO8601DateFormatter().string(from: date), "course": "一分钟测试"]; ledger = records
        return ["message": "系统已接受测试闹钟。请锁屏，等待 1 分钟验证响铃。"]
    }
}
