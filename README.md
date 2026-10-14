# 晨课 · 个人课表

一个零付费服务、无后台的个人课表项目。共享界面已可运行；鸿蒙与 iOS 原生工程已提供。**iOS 原生版已通过 GitHub 的 Xcode 云编译并生成未签名 IPA；个人签名、安装和真机响铃尚未验证。鸿蒙版仍需 SDK 编译与真机验证。**

用户设备：鸿蒙 7、最新版 iOS；只有 Windows，没有 Mac。

## 已实现

- 文字 PDF、扫描 PDF、PNG/JPG 图片在本机识别；中文/英文 OCR 模型随项目打包。iOS 原生文件导入使用系统 PDFKit/Vision。
- 表格按星期列和时间/节次分组，支持直接时间、单双周、离散周次。每门识别课程保留原文；导入结果需核对确认。
- 编辑课程名称、地点、星期、起止时间、周次、颜色；单次补课可指定日期。
- 周课表、今日列表、当前时间线、今天位置指针、明日起床预览、浅色/暗色、手机/桌面布局。
- 取当日第一门晨课，减可调提前量。默认 90 分钟、上午截止 12:00，均可修改；支持跨天提前。
- 停课/假日、按其他星期调课、学期起点与总周数、学校节次表、时间冲突提示、JSON 备份恢复、课程日历导出。
- 鸿蒙：系统后台代理提醒，按具体日期发布自定义响铃和稍后提醒；iOS 26+：AlarmKit 固定日期系统闹钟。
- 调度窗口 28 天，应用启动/返回、课程或规则修改时重新计算；只管理本应用创建的提醒。不确认的晨课、休息日、演示数据不发布闹钟。

## 立即预览

安装了 Node.js 后，在本目录运行：

```powershell
npm.cmd ci
npm.cmd run assets
npm.cmd run build
npm.cmd run preview
```

打开 <http://127.0.0.1:5173/>，或者双击 `启动预览.cmd`。运行窗口只用于电脑本地预览，手机原生版会将界面直接打包在应用里。

首次进入是空课表；可选择「先体验演示课表」，不会设置闹钟。要开始真实记录，选择「开始自己的课表」并导入。

导入后请先在「设置」确认学期第1周的星期一；初始日期只是当前周的默认值，不能代替学校校历。再逐门确认课程，并启用起床提醒。

### 开发与校验

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run assets
npm.cmd run build
npm.cmd test
npm.cmd run test:ui
```

依赖采用 package-lock.json 固定版本。`assets` 仅构建时从开源项目下载中文/英文 OCR 模型，应用运行不调用识别服务。`build` 把 dist 复制到两个原生项目内。UI 测试当前使用 Windows Edge，包含真实样本文件上传与 OCR。

## 鸿蒙 7 安装

鸿蒙工程已更新到 0.1.1，目标 API 26、最低 API 20，包名 `com.andijues.chenke`。修正已有提醒的查询、加入权限检查和前台返回时重新同步，明确使用闹钟声音通道。官方工具尚未获取成功，当前仍未编译/签名 HAP。

完整步骤和命令见 [Windows 构建与安装鸿蒙版](docs/Windows安装鸿蒙.md)。

1. 在 Windows 安装官方 [DevEco Studio](https://developer.huawei.com/consumer/cn/deveco-studio/) 26.0.0，或下载配套 Command Line Tools 26.0.0.851。
2. 命令行工具解压后，在项目目录运行 `node scripts/build-harmony.mjs --tools "D:/Plugin/HarmonyOS26" --stage "D:/Plugin/HarmonyOSBuild"`；脚本先在独立目录编译未签名 HAP，成功后才保存到 `output/晨课-鸿蒙-未签名.hap`。
3. 登录自己的华为开发者账号，完成需要的认证，配置 **Automatic signing** 并关联自己的手机。
4. 在 DevEco Studio 打开独立工程，手机开启开发者选项/USB 调试，连接电脑，在 IDE 点击运行。个人签名配置保留在独立工程中。
5. 在应用中导入课表、校对晨课、启用自动提醒，并允许通知。
6. 先执行「测试 1 分钟后提醒」，检查锁屏、声音、稍后提醒、退出应用、重启后的行为。签名有效期以实际平台为准。

这里的提醒由应用通过系统代理管理，**不等于往华为“时钟”App 的手动闹钟列表写入**。响铃的通知/闹钟通道表现必须在鸿蒙 7 真机上确认。按日期使用 Calendar 类型，避免把课程简单设成每周重复后在放假日误响。

## iOS：只有 Windows 的免费安装路线

源码已发布到 [chenke-timetable](https://github.com/andijues/chenke-timetable)，[2026-10-14 的云构建](https://github.com/andijues/chenke-timetable/actions/runs/38552993453)已成功。使用 Xcode 26.6、iOS 26.5 SDK，应用最低支持 iOS 26.0。构建源码提交为 `4ac5feb63882db6eaeaca79d31a2b130c46dfdda`。

本机安装包保存在 `output/晨课-iOS-未签名.ipa`。操作步骤见 [Windows 安装 iOS 版](docs/Windows安装iOS.md)。以后重新构建可按以下流程执行：

1. 将项目源码放到**你确认公开的 GitHub 仓库**。免费云构建只面向标准公共仓库；工作流遇到私有仓库直接跳过。
2. 在 Actions 页面手动运行 **Build iOS unsigned IPA**。流程先构建共享界面，再在 GitHub 的标准 Mac runner 运行 Xcode，最后保存 `Chenke-unsigned-IPA`，仅保留 1 天。
3. 构建成功后下载 artifact ZIP，解压得到 `.ipa`。**这里的 unsigned IPA 还不能直接点开安装**。
4. 在 Windows 使用 [Sideloadly 官方版](https://sideloadly.io/) 以自己的免费 Apple ID 给自己的 iPhone 签名安装。Windows 所需 Apple 驱动/iTunes/iCloud 依该工具当前指引处理；本项目不自动修改你现有的 Apple 软件。
5. 手机允许开发者模式与应用信任后打开晨课，启用 AlarmKit 权限并进行一分钟锁屏响铃测试。
6. 免费签名有效期 7 天；Windows 的刷新工具可续签，但需电脑/手机可连接并成功刷新。**没有成功续签时不能依赖该 App 持续叫醒你。**

GitHub 标准公共 runner 的免费计算条件见 [官方计费文档](https://docs.github.com/en/billing/concepts/product-billing/github-actions)。仍应保持账号 Actions/存储预算为 0，避免选择付费大型 runner、私有仓库超额或长期堆积 artifact。Sideloadly 官方说明支持免费 Apple ID，Apple [官方限制](https://developer.apple.com/help/account/basics/about-your-developer-account)说明了 7 天安装签名有效期。

云编译已在这个公开仓库成功运行；**免费 Apple ID 签名及 iPhone 安装、AlarmKit 授权、锁屏响铃还需实际验证**。构建成功不能代替真机测试。

### 如果以后能使用 Mac

直接打开 `native/ios/Chenke.xcodeproj`，用 Xcode 26+、iOS 26+ SDK 编译。在 Signing & Capabilities 选择自己的 Personal Team，修改 bundle identifier 为个人唯一值，连接手机 Run。免费签名同样需要刷新。

### 网页与快捷指令备用

`dist` 是可部署到免费静态托管的网页应用；浏览器课表与 OCR可用，但网页不能直接发布系统闹钟。起床页提供下一次计划传给快捷指令的入口，配置方法在 `docs/iOS快捷指令备用方案.md`。**这是需要一次配置和课表修改后同步的备用方案，不能当作已完成的原生自动闹钟。**

## 实际使用边界

- 未收到你的真实课表，当前只用标为演示的测试样本验证。不同学校合并单元格、教师名单、跨页表格可能需要修改识别结果。
- OCR 永远需要校对，不保证图片全部识别正确；原文保留供手动补充。未找到时间会明确标记，不能默默把推算当作准确结果。
- 所有课程按中国标准时间 UTC+8 解释。旅行或系统时区调整后需重新打开并检查起床计划。
- 闹钟窗口为未来 28 天，定期打开应用续排；不宣称无限期后台执行。手机关机、权限撤销、系统限制和签名过期均需要真机验证和处理。
- 当前无云账号体系、自动跨设备同步、收费接口；可以用 JSON 备份转移数据。

## 项目文件

`src/` 为规则、解析、界面和原生桥接；`native/harmony/` 和 `native/ios/` 为原生工程；`dist/` 为已构建预览；`tests/fixtures/` 为带演示标记的文字/扫描 PDF 与图片。`reports/` 为检查记录，`.impeccable/review/` 为网页截图。
