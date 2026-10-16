# Windows 构建和使用 Android 版

0.3.1 本地调试签名 APK：output/晨课-Android-调试.apk。本轮重做今日首页和明日起床界面，增加前台自动请求明日系统时钟闹钟；不会自动安装到手机。不需要服务器、付费开发者账号或应用商店。历史设备结果：0.2.3 在鸿蒙 7 的卓易通中主页正常，但退出后台后不响；0.2.4 调用系统时钟时提示没有提供创建时钟闹钟的接口。因此该机的 APK 暂不能直接交给鸿蒙自带时钟；这些旧版结果不算 0.3.1 的真机验收。

APK 声明最低 Android 8.0（API 26），目标 Android 16（API 36）。本次在 Windows 编译和静态校验，尚未在 Android 真机验证。请使用更新的 Android System WebView，旧 WebView 可能缺少 PDF/OCR 需要的浏览器能力。

0.2.3 将首页 HTML、样式与入口脚本直接从安装包交给 WebView，接受本机 HTTPS 地址的默认 443 端口及内核内部页面资源。PDF.js 主库和解析模块使用同版本 legacy 构建，并为旧内核补充 Promise.withResolvers 和 ReadableStream 异步迭代。构建目标明确为 Chrome 114；初始化失败时显示可复制的原生诊断页。手机效果需以本版实测为准。

[PDF.js 官方说明](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions#which-browsersenvironments-are-supported)将现代构建和 legacy 构建分开；其当前 legacy 支持范围也高于本机报告的 Chrome 114，所以本项目另做实际 Chrome 114 的启动、PDF 与 OCR 回归，不能只依据系统显示 Android 16 判断网页能力。

## 安装与首次使用

准备好手机后，可把 APK 传到自己的手机，在文件管理器中打开，按系统要求允许该文件来源安装。后续升级使用相同包名和本机调试签名，先导出 JSON 备份；卸载会删除本地课程记录。

1. 设置学校学期第一天、总周数。学期第一天可以是任意星期；其所在周为第 1 周，之前日期不排常规课。
2. 设置通用节次，或切换星期设置当天独立的节数和时间。可在时间轴选节次，用滑块或时间输入调整。
3. 导入 PDF/图片并逐门校对，或者从首页添加课程。支持按节次或精确时间、周次区间、单双周和逐周点选。
4. 在「闹钟」选择「手机系统时钟」，设置提前量并开启「自动安排明天的闹钟」。此后打开或返回应用时，按明天首课自动发送免确认请求；正常使用无需每天再点交接或保存。首次使用仍应在系统时钟列表核对接收情况。
5. 先点「测试时钟（1–2 分钟）」，查看系统时钟是否接收测试请求，再清理晨课后台并锁屏。确认接收闹钟的是手机自带时钟；如果卓易通不提供转接，会显示具体说明，可在自带时钟手动按起床时间添加。

系统时钟模式使用 Android 官方 [AlarmClock.EXTRA_SKIP_UI](https://developer.android.com/reference/android/provider/AlarmClock#EXTRA_SKIP_UI) 请求跳过中间界面，不再要求每天手动确认。接收方仍可能显示自己的界面，公共接口也没有保存成功或手动删除回执，所以应用显示「已发送免确认请求」。首次请核对系统时钟，后续可在其中直接手动删除；删除后晨课不自动补回同一计划，需要时主动「重新发送」。

公共接口没有通用的具体日期字段；不设置每周重复参数，只在明天目标时间等于下一次实际发生时发送。凌晨目标钟点尚未过去时会等待，避免误设成今天。课程或提前量改变后须先删除旧闹钟，再重新发送；关闭、暂停、切换方式或清空课表不会删除外部时钟闹钟，界面会保留管理提示。时钟模式不向晨课索取通知或准确闹钟授权。完整规则见[今天安排明天](系统时钟自动安排.md)。

本机的实际失败提示对应找不到接收 ACTION_SET_ALARM 的应用，增加晨课的通知或准确闹钟权限不会补出该接口。目前可在鸿蒙自带时钟按课表起床时间手动添加。鸿蒙原生版的代理提醒属于另一条系统调度路径；2026-10-15 刷新后台后仍为审核中，尚未更新能力 Profile 或安装鸿蒙版。

可选「晨课后台提醒」保留原有系统定时器和本应用响铃功能。切到系统时钟时会清理晨课自己的计划；不会修改手机时钟中其他闹钟。

晨课后台提醒响铃最长 1 分钟，可稍后 5 分钟，最多两次。它通过 Android 系统定时器触发晨课的原生响铃服务，不写入时钟列表。该方式在本机卓易通清理后台后测试失败，不能当作本机已可靠验收的叫醒方式。

部分手机需要为晨课允许自启动和后台运行，以设备实测为准。在系统设置中“强行停止”、冻结应用或撤销准确闹钟权限会使计划失效；请重新打开并更新。通知频道被关闭时不会显示已成功调度。

后台提醒窗口为 28 天，打开/返回应用或修改课表时续排；重启接收器恢复窗口内已经保存的未来计划，不会在开机广播中直接启动播放服务。系统时钟模式在应用前台自动请求明日计划；受 Android 后台启动限制，全天不打开应用不保证续排。课程和计算采用学校所在的北京时间。

## 在电脑重新构建

使用免费的官方工具：

- [Android Command Line Tools](https://developer.android.com/studio#command-line-tools-only)，接受 SDK 许可，安装 platforms;android-36 和 build-tools;35.0.0。
- [Gradle 8.13](https://gradle.org/releases/) 与 JDK 17。
- Node.js 与项目 package-lock.json 固定的依赖。

本机工具位于 D:/ChenkeAndroidBuild，复用已有 Temurin JDK 17。构建脚本使用独立英文目录和独立 Gradle 缓存，不改变系统环境变量。

    npm.cmd ci
    npm.cmd run assets
    npm.cmd run build
    node scripts/build-android.mjs --sdk D:/ChenkeAndroidBuild/sdk --gradle D:/ChenkeAndroidBuild/tools/gradle-8.13/bin/gradle.bat --java D:/ChenkeHarmonyBuild/tools/jdk17/jdk-17.0.20.1+1 --stage D:/ChenkeAndroidBuild --keystore D:/ChenkeAndroidSigning/chenke-debug.keystore
    python -X utf8 scripts/verify-android-artifact.py

脚本执行 42 项 JVM 检查（7 项时间规则、6 项启动页面、13 项资源规则、16 项时钟交接日期），以及 assembleDebug 和 lintDebug，然后生成 APK；构建脚本不会执行设备命令。调试密钥存于工程外，源码、公开仓库和交付归档均不包含密钥。请保留该密钥以便以后覆盖升级。

验证记录在 reports/android-build.json。检查 ZIP、DEX 类、Manifest、官方 apksigner v2 签名、共享界面哈希和中英文模型内容。AAPT 会解压 .gz 模型并移除后缀，原生资源读取已处理该行为；校验器比较打包后的模型与原模型解压结果。

这些检查证明编译和包内容，不能替代手机的通知、锁屏、后台限制和实际响铃验收。

鸿蒙 5 及以上不能直接等同 Android；APK 在卓易通中的安装和系统能力取决于其兼容环境。[华为说明](https://consumer.huawei.com/cn/support/content/zh-cn16061787/)列出了 APK 的兼容安装方式。本项目的兼容环境反馈按 APK 哈希记录在 reports/android-compatibility-test.json，旧版结果不能作为新版验收。

实现依据：[准确闹钟](https://developer.android.com/develop/background-work/services/alarms)、[前台服务后台启动条件](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)、[媒体播放服务与开机限制](https://developer.android.com/develop/background-work/services/fgs/service-types)、[Android 14 全屏通知权限](https://developer.android.com/about/versions/14/behavior-changes-14)。
