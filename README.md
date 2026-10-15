# 晨课 · 个人课表

一个零付费服务、无服务器的个人课表项目。0.2.0 增加可视化节次、手动排课和 Android 原生工程。**本次只做代码、浏览器预览与安装包构建，未连接或安装到手机。** 鸿蒙旧版 0.1.1 的主页已由用户确认可打开；代理提醒能力申请仍待完成授权和响铃验收。iOS 免费云构建产生未签名 IPA，个人签名与真机测试另行完成。Android 使用系统准确闹钟和原生响铃服务，设备响铃尚未实测。

用户设备：鸿蒙 7、最新版 iOS；只有 Windows，没有 Mac。

## 已实现

- 文字 PDF、扫描 PDF、PNG/JPG 图片在本机识别；中文/英文 OCR 模型随项目打包。iOS 原生文件导入使用系统 PDFKit/Vision。
- 表格按星期列和时间/节次分组，支持直接时间、单双周、离散周次。每门识别课程保留原文；导入结果需核对确认。
- 首页可直接手动添加课程，按节次选择或精确填写时间。
- 学期首日不限星期一，自动显示第1周对应周一；支持起止周、每周/单周/双周、逐周点选及实际日期预览。
- 通用节次及每天独立设置，星期独立设置允许0–20节；时间轴、滑块及精确输入共同编辑。按节次录入的课程和起床计划联动更新。
- 周课表、今日列表、当前时间线、今天位置指针、明日起床预览、浅色/暗色、手机/桌面布局。
- 取当日第一门晨课，减可调提前量。默认 90 分钟、上午截止 12:00，均可修改；支持跨天提前。
- 停课/假日、按其他星期调课、学期起点与总周数、学校节次表、时间冲突提示、JSON 备份恢复、课程日历导出。
- 鸿蒙：系统后台代理提醒；iOS 26+：AlarmKit 固定日期闹钟；Android：系统准确闹钟、原生响铃页、关闭和最多两次稍后5分钟。
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

先在「设置」填写学校学期第一天、总周数及节次，再导入和校对课程；也可从首页直接手动排课。默认日期不能代替学校校历。

### 开发与校验

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run assets
npm.cmd run build
npm.cmd test
npm.cmd run test:ui
```

依赖采用 package-lock.json 固定版本。`assets` 仅构建时从开源项目下载中文/英文 OCR 模型，应用运行不调用识别服务。`build` 把 dist 复制到三个原生项目内。UI 测试当前使用 Windows Edge，包含真实样本文件上传与 OCR。

## Android 安装与构建

已生成 output/晨课-Android-调试.apk；支持系统准确闹钟、原生关闭/稍后提醒、重启恢复和本地文件选择/备份。无需应用商店、服务器或付费账号。APK 声明最低 Android 8.0，目标 API 36；本次仅 Windows 编译与包校验，没有真机安装或响铃验收。详细步骤见 [Windows 构建和使用安卓](docs/Windows安装安卓.md)。

## 鸿蒙 7 安装

鸿蒙工程为 0.2.0，目标 API 26、最低 API 20，包名 `com.andijues.chenke`。本机官方工具位于 `D:\command-line-tools`，已生成未签名及已签名 HAP。当前签名包仅适用于已登记的自己的手机；本次没有安装。

完整步骤和命令见 [Windows 构建与安装鸿蒙版](docs/Windows安装鸿蒙.md)。

1. 准备官方 Command Line Tools 26.0.0.851 和 JDK 17；此命令行工具包未自带 JDK。
2. 使用 `scripts/build-harmony.mjs --tools ... --java ... --stage ...` 在独立目录编译，再使用 `scripts/verify-harmony-artifact.py` 检查内容。
3. 通过实名认证华为开发者账号创建匹配包名的调试证书、自己的设备记录与 Profile。私钥和密码保存在项目外。
4. 使用 `scripts/sign-harmony.mjs` 核对证书、单设备 Profile 后签名，以官方 HDC 覆盖安装。也可按官方 DevEco Studio 自动签名流程操作。
5. 在应用中导入课表、校对晨课、启用自动提醒，并允许通知。
6. 先执行「测试 1 分钟后响铃」，检查锁屏、声音、稍后提醒、退出应用、重启后的行为。签名有效期以实际平台为准。

这里的提醒由应用通过系统代理管理，**不等于往华为“时钟”App 的手动闹钟列表写入**。响铃的通知/闹钟通道表现必须在鸿蒙 7 真机上确认。按日期使用 Calendar 类型，避免把课程简单设成每周重复后在放假日误响。

本次真机测试返回1700002，而晨课有效提醒数量为0；后台“代理提醒”能力原为“未申请”，Profile 中该开放能力为空。现已授权提交申请，平台显示“审核中”，页面提示审批3个工作日；获准后需取得对应 Profile 并重新签名。资料见 [代理提醒申请说明](docs/鸿蒙代理提醒申请.md)。不应因此删除手机其他应用或时钟的闹钟。

## iOS：只有 Windows 的免费安装路线

源码已发布到 [chenke-timetable](https://github.com/andijues/chenke-timetable)，[2026-10-14 的最新 iOS 云构建](https://github.com/andijues/chenke-timetable/actions/runs/38575471683)已成功，包含移动端和多行粘贴解析修正。使用 Xcode 26.6、iOS 26.5 SDK，应用最低支持 iOS 26.0。IPA 对应源码提交为 `e5a77b64df753555579734148cf8da13ce64742e`。

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

`src/` 为规则、解析、界面和原生桥接；`native/harmony/`、`native/ios/` 和 `native/android/` 为原生工程；`dist/` 为已构建预览；`tests/fixtures/` 为带演示标记的文字/扫描 PDF 与图片。`reports/` 为检查记录，`.impeccable/review/` 为网页截图。
