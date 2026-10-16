# 在 Windows 构建和安装晨课鸿蒙版

本项目为鸿蒙原生 HAP 工程，目标 API 26，最低 API 20。当前源码与未签名 HAP 为 **0.3.3**，本轮精简共享界面重复说明，较长帮助按需展开；保留系统返回、授权状态和提醒安全更新逻辑。**按用户要求，本轮不更新签名、不安装手机。** 等代理提醒审核通过后再取得带能力的 Profile 并签名；最近一次平台状态检查为 2026-10-15，仍在审核中，本轮未再次查询。

`output/晨课-鸿蒙-已签名.hap` 仍为旧版 0.2.0。旧版 0.1.1 的主页启动记录单独保留，不代表 0.3.3 已在手机启动或锁屏响铃。当前未签名包可供后续签名准备，不能直接安装。

## 获取官方工具

1. 在 [华为下载中心](https://developer.huawei.com/consumer/cn/download/)用自己的实名认证开发者账号登录。
2. 下载 **Command Line Tools for Windows 26.0.0.851**。工具包约 2.5 GB，包含相应版本 SDK。
3. 按下载页的 SHA-256 校验工具包，再解压到不含中文或特殊符号的目录。本机工具路径为 `D:\command-line-tools`，保留完整目录层次。
4. 此命令行工具包未自带 Java。使用另行下载并校验的免费 Temurin JDK 17，本机位于 `D:\ChenkeHarmonyBuild\tools\jdk17\jdk-17.0.20.1+1`。

官方工具获取和版本升级规则见 [命令行工具指南](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/ide-commandline-get)与 [API 26 适配指南](https://developer.huawei.com/consumer/en/doc/harmonyos-releases/upgrade-adaptation)。

## 编译未签名 HAP

在课表项目目录运行：

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run assets
npm.cmd run build
node scripts/build-harmony.mjs --tools D:/command-line-tools --java D:/ChenkeHarmonyBuild/tools/jdk17 --stage D:/ChenkeHarmonyBuild
python -X utf8 scripts/verify-harmony-artifact.py
```

脚本使用另行指定的 JDK 和工具包中的 Node、Hvigor、SDK，在独立英文路径编译。它只生成未签名 HAP，保留源工程；不把个人签名配置写进 Git 仓库，不修改系统环境变量。restool 缺少同目录 DLL 时，仅补充工具包中已有的官方 DLL，不覆盖已有文件。

编译成功才会生成 `output/晨课-鸿蒙-未签名.hap` 和 `reports/harmony-build.json`。日志位于 `reports/harmony-build.log`。工具不完整或编译失败时，不会把源码改名成安装包。

如果已经装有对应版本的 DevEco Studio，也可用 `--tools` 指向其安装目录。实际工具包结构或 SDK 版本不同，可能需要调整构建配置；以真实编译结果为准。

## 本机已有签名资料

此前通过华为开发者账号创建了匹配包名的调试证书、自己的设备记录与 Profile。私钥和密码保存在项目外的 `D:\ChenkeHarmonySigning\chenke-1791984176207`。已有资料时不用每次生成新密钥：

```powershell
node scripts/sign-harmony.mjs --java D:/ChenkeHarmonyBuild/tools/jdk17/jdk-17.0.20.1+1/bin/java.exe --tools D:/command-line-tools --signing D:/ChenkeHarmonySigning/chenke-1791984176207
$chenkeHdc = 'D:\command-line-tools\sdk\default\openharmony\toolchains\hdc.exe'
& $chenkeHdc list targets
Copy-Item -LiteralPath output\晨课-鸿蒙-已签名.hap -Destination D:\ChenkeHarmonyBuild\install\chenke.hap -Force
& $chenkeHdc install -r D:\ChenkeHarmonyBuild\install\chenke.hap
& $chenkeHdc shell aa start -a EntryAbility -b com.andijues.chenke
```

下列签名和安装命令仅供能力获准且用户恢复安装授权后使用，本轮未执行。先确认本次编译成功，再签名和安装，避免误用旧包。签名脚本核对证书公钥、包名及单设备 Profile，并调用官方工具验签。多台手机连接时，使用 `-t` 明确指定设备。覆盖安装保留应用数据；当前包仅适用于已登记的这台手机。

首次准备可使用 `scripts/prepare-harmony-signing.mjs` 在项目外生成 P12 和公开 CSR；通过自己的华为账号申请证书与 Profile。证书文件命名为 `app-debug.cer`、Profile 为 `debug-profile.p7b`，与本机设备核对记录 `device.json` 放在该签名目录。不要公开私钥、密码或设备标识。

## 另一种方式：DevEco Studio 自动签名

未签名 HAP 不能直接安装到鸿蒙手机。签名需关联自己的开发者账号和设备。

1. 下载官方 **DevEco Studio 26.0.0 Release**，安装后打开用于编译的独立工程。不要在准备公开的源码目录保存个人签名密码。
2. 用自己的华为开发者账号登录；工程的包名为 `com.andijues.chenke`。如创建自己的签名资料，需要与这个包名一致。
3. 在项目 **Signing Configs** 配置页启用 **Automatically generate signature**，选择自己的设备并完成签名。
4. 手机开启开发者选项与 USB 调试，连接 Windows，按系统提示允许连接。
5. 在 IDE 选择手机点击 Run，确认手机出现「晨课」，并能够打开首页。

签名文件、设备标识和密码保存在本机。调试签名有效期以华为平台实际显示为准，本文不预设期限。

## 导入与响铃验收

本次设备查询显示晨课有0个有效提醒，发布测试仍返回1700002。华为后台原显示代理提醒“未申请”，下载 Profile 的开放能力为空。现已提交学习类起床提醒申请，状态“审核中”，页面提示3个工作日。获准后需取得包含代理提醒能力的新 Profile，重新签名安装。申请说明见 [鸿蒙代理提醒申请](鸿蒙代理提醒申请.md)。不应因此删除手机其他应用或时钟的闹钟。

1. 在「设置」输入真实学期第 1 周开始上课的日期（不限星期一）、总周数和学校节次时间。
2. 导入 PDF 或图片，核对课程名称、星期、起止时间、周次，确认后保存。
3. 在「闹钟」设定提前量，例如第一节 8:30、提前 90 分钟，对应 7:00 起床。
4. 启用自动提醒，允许通知，检查是否显示系统已接受计划。拒绝权限时，页面会显示失败原因。
5. 执行「测试 1 分钟后响铃」，退出应用并锁屏等待，检查铃声、关闭和稍后提醒。
6. 再分别检查退出应用、重启、静音/勿扰状态，以及无晨课、停课日和修改课程后的计划。

使用的是系统后台代理提醒，以具体日期发布，并采用闹钟声音通道。它的锁屏和勿扰表现仍需手机测试，不宣称会出现在华为「时钟」的手动闹钟列表中。

未来提醒窗口为 28 天。打开或返回应用时重新核对系统计划；更改提前量、课程和例外日期后会更新。演示和未确认的课程不会发布真实提醒。

## 本次更新与验证范围

- 修正已有提醒的查询接口，使用带提醒编号的结果，便于更新和撤销本应用的提醒。
- 增加通知权限状态检查及系统提醒数量超限的错误说明。
- 明确使用闹钟声音通道，保留一分钟测试与两次五分钟稍后提醒。
- 允许文件保存对话框打开期间更新或关闭起床提醒。
- 返回前台时重新同步，避免缓存让页面忽略系统权限变化。
- 返回授权对话框后保留一分钟测试，防止课程计划同步误取消测试提醒。
- 新增 Windows 命令行构建和 HAP 内容校验脚本。

0.3.3 的局部界面检查与官方未签名编译记录见 reports/validation.json；未变更的规则和 ArkTS 桥接测试按历史记录保留。网页截图只证明共享界面；当前 HAP 未签名、未安装、未验收锁屏响铃。旧版签名、安装和主页打开记录单独保留，不代表新版已验收。
